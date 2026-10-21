// Transport layer. Every screen talks to the backend (backend/, Python FastAPI + PostgreSQL) through `api.*`,
// which calls `request()` — a plain fetch with a bearer token and If-Match headers. There is no in-browser mode.
//
// API base URL: VITE_API_BASE_URL (absolute, e.g. https://api.example.com/api/v1), baked in at build time.
// When it is not set the app calls /api/v1 on its own origin (the API serving the build, or a reverse proxy
// that routes /api to it).
import { useSession } from '@/stores/session'
import { useConnectivity } from '@/stores/connectivity'

export class ApiError extends Error {
  status: number
  code: string
  field?: string
  /** x-request-id of the failed call — shown for server errors so support can find it in the logs */
  requestId?: string
  constructor(status: number, code: string, message: string, field?: string, requestId?: string) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
    this.requestId = requestId
  }
}

export interface RequestOptions {
  query?: Record<string, unknown>
  body?: unknown
  ifMatch?: number
}

export interface ApiEnvelope<T> {
  data: T
  warnings: { code: string; message: string }[]
}

/** The API base URL without a trailing slash. */
export const API_BASE = (((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').trim() || '/api/v1').replace(/\/+$/, '')

/** Statuses that mean "the API is not reachable right now" (gateway / load balancer / maintenance). */
const UNAVAILABLE = new Set([502, 503, 504])

function headers(): Record<string, string> {
  const s = useSession.getState()
  const h: Record<string, string> = {}
  if (s.token) h['Authorization'] = `Bearer ${s.token}`
  if (s.viewAs) h['X-View-As'] = s.viewAs.key
  return h
}

/** POSTs that only compute or read (previews, quotes, simulations, report runs, sign-in): they change no stored data.
 *  Report runs are queries (report page, builder preview, pinned reports on the dashboard): treating them as writes made
 *  every run refresh every query, which re-ran the report — an endless request loop. (/payroll/run IS a write.) */
const READ_ONLY_POST = /\/(preview|quote|simulate|check)$|^\/reports\/(?:[^/]+\/)?run$|^\/ai\/|^\/auth\/(login|login\/mfa|logout|reset-request)$/
function isWrite(method: string, path: string, opts: RequestOptions): boolean {
  if (method === 'GET' || method === 'HEAD') return false
  if (method === 'POST' && READ_ONLY_POST.test(path)) return false
  const mode = (opts.query?.mode ?? (opts.body as { mode?: unknown } | undefined)?.mode) as unknown
  return mode !== 'preview'
}
let writeListener: (() => void) | null = null
/** Called after every successful write (any non-read-only POST/PUT/PATCH/DELETE) — the query layer refreshes data. */
export function onSuccessfulWrite(fn: () => void) {
  writeListener = fn
}

// Test hook: an automated crawler may define window.__apiErrors to collect failed calls (no effect otherwise).
function recordFailure(method: string, path: string, status: number, code: string | undefined, message: string) {
  const sink = (globalThis as { __apiErrors?: unknown[] }).__apiErrors
  if (Array.isArray(sink)) sink.push({ method, path, status, code, message })
}

/** Low-level call returning data + non-blocking warnings. */
export async function requestFull<T>(method: string, path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const h = headers()
  if (opts.ifMatch !== undefined) h['If-Match'] = String(opts.ifMatch)
  const qs = opts.query
    ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : ''
  let res: Response
  try {
    res = await fetch(API_BASE + path + qs, {
      method,
      credentials: 'same-origin', // auth is the bearer header; no cookies are used
      cache: 'no-store', // always read current data; React Query is the only cache
      headers: { 'Content-Type': 'application/json', ...h },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    // DNS / connection refused / CORS rejection / offline: fetch itself fails
    const msg = 'Can’t reach the server. Check your connection and try again.'
    useConnectivity.getState().markDown('Check your connection; we’ll keep trying.')
    recordFailure(method, path, 0, 'NETWORK', msg)
    throw new ApiError(0, 'NETWORK', msg)
  }
  if (UNAVAILABLE.has(res.status)) useConnectivity.getState().markDown('The server is temporarily unavailable; we’ll keep trying.')
  else useConnectivity.getState().markUp()

  const text = res.status === 204 ? '' : await res.text().catch(() => '')
  let json: unknown = {}
  let parsed = true
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      parsed = false
    }
  }
  if (!res.ok) {
    const e = ((json as { error?: { code?: string; message?: string; field?: string; request_id?: string } })?.error ?? {}) as { code?: string; message?: string; field?: string; request_id?: string }
    // a 401 on a signed-in call means the session ended: drop it so the router sends the person to sign in
    if (res.status === 401 && useSession.getState().token) useSession.getState().logout()
    // a proxy / load balancer may answer without our JSON envelope: still say what to do
    const retry = Number(res.headers.get('Retry-After'))
    const fallback =
      res.status === 429
        ? `Too many requests. Try again in ${retry > 0 ? `${retry} second${retry === 1 ? '' : 's'}` : 'a minute'}.`
        : UNAVAILABLE.has(res.status)
          ? 'The server is temporarily unavailable. Try again in a moment.'
          : res.status >= 500
            ? 'Something went wrong on our side. Try again.'
            : res.statusText || `Request failed (${res.status}).`
    const requestId = e.request_id ?? res.headers.get('X-Request-Id') ?? undefined
    // server errors: every place that shows the message also shows the id support needs to find it in the logs
    const message = (e.message ?? fallback) + (res.status >= 500 && requestId ? ` Request ID: ${requestId}` : '')
    const err = new ApiError(res.status, e.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'HTTP_' + res.status), message, e.field, requestId)
    recordFailure(method, path, res.status, err.code, err.message)
    throw err
  }
  if (!parsed) {
    // e.g. an HTML page from a static host: the API base URL points at the wrong server
    const err = new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response. The API address may be misconfigured.')
    recordFailure(method, path, res.status, err.code, err.message)
    throw err
  }
  if (isWrite(method, path, opts)) writeListener?.()
  const { warnings = [], ...rest } = (json ?? {}) as { warnings?: ApiEnvelope<T>['warnings'] }
  const data = json && typeof json === 'object' && 'data' in (json as object) ? (json as { data: T }).data : (rest as T)
  return { data, warnings }
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  return (await requestFull<T>(method, path, opts)).data
}

/** Reachability probe used by the offline banner: any HTTP answer except 502/503/504 means the API is up. */
export async function pingApi(): Promise<boolean> {
  try {
    const res = await fetch(API_BASE + '/me', { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
    return !UNAVAILABLE.has(res.status)
  } catch {
    return false
  }
}

export const http = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, ifMatch?: number) => request<T>('POST', path, { body, ifMatch }),
  patch: <T>(path: string, body?: unknown, ifMatch?: number) => request<T>('PATCH', path, { body, ifMatch }),
  put: <T>(path: string, body?: unknown, ifMatch?: number) => request<T>('PUT', path, { body, ifMatch }),
  del: <T>(path: string, ifMatch?: number) => request<T>('DELETE', path, { ifMatch }),
  full: requestFull,
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
