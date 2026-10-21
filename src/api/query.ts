import { QueryClient, useMutation, useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, onSuccessfulWrite, requestFull } from './http'
import { useSession } from '@/stores/session'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // 4xx answers are final; network errors and 5xx get two quick retries
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      // coming back to the tab shows what colleagues changed meanwhile
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})

// Data freshness: after ANY successful write the server's state has changed, possibly in places the screen does not
// know about (a new task moves dashboards, inbox counts, project health…). So every cached query is marked stale and
// the ones on screen refetch at once; the rest refetch when next shown. Writes in one burst (bulk actions) coalesce
// into one refresh. Per-mutation `invalidate` lists are therefore documentation, not the mechanism.
let refreshTimer: ReturnType<typeof setTimeout> | null = null
export function refreshAfterWrite() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    queryClient.invalidateQueries()
  }, 0)
}
onSuccessfulWrite(refreshAfterWrite)

/** Query keys are prefixed with tenant + view-as so switching never shows another tenant's cache. */
export function useScopeKey(): string[] {
  const { tenant, viewAs, user } = useSession()
  return [tenant?.id ?? 'none', viewAs?.key ?? user?.role_key ?? user?.role ?? 'anon']
}

export function useApi<T>(key: QueryKey, fn: () => Promise<T>, opts: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'> = {}) {
  const scope = useScopeKey()
  return useQuery<T, Error, T, QueryKey>({ queryKey: [...scope, ...(key as unknown[])], queryFn: fn, ...opts })
}

export interface MutOpts<V, R> {
  /** Query-key prefixes (without scope) this write affects — documentation only: every successful write refreshes all
   *  queries (see refreshAfterWrite), so a missing or wrong entry can never leave a list stale. */
  invalidate?: QueryKey[]
  success?: string | ((r: R, v: V) => string | null)
  onSuccess?: (r: R, v: V) => void
  onError?: (e: ApiError, v: V) => void
  silentError?: boolean
}

export function toastError(e: unknown) {
  const err = e as ApiError
  const title =
    err.status === 0 ? 'Can’t reach the server' : err.status === 401 ? 'Signed out' : err.status === 404 ? 'Not found' : err.status === 429 ? 'Too many requests' : err.status >= 500 ? 'Server error' : err.status === 403 ? 'Not allowed' : err.status === 402 ? 'Workspace is read-only' : err.status === 409 && err.code === 'STALE' ? 'This changed while you were editing' : err.status === 409 ? 'Rule check failed' : err.status === 422 ? 'Check the form' : 'Something went wrong'
  toast.error(title, { description: err.message })
}

/** Mutation with the house behaviour: toasts, warnings[], backend error messages (data refresh is automatic). */
export function useMut<V, R = unknown>(fn: (v: V) => Promise<{ data: R; warnings: { code: string; message: string }[] } | R>, opts: MutOpts<V, R> = {}) {
  return useMutation<R, ApiError, V>({
    mutationFn: async (v) => {
      const res = await fn(v)
      if (res && typeof res === 'object' && 'warnings' in (res as object) && 'data' in (res as object)) {
        const r = res as { data: R; warnings: { code: string; message: string }[] }
        r.warnings.forEach((w) => toast.warning(w.message))
        return r.data
      }
      return res as R
    },
    onSuccess: (r, v) => {
      const msg = typeof opts.success === 'function' ? opts.success(r, v) : opts.success
      if (msg) toast.success(msg)
      opts.onSuccess?.(r, v)
    },
    onError: (e, v) => {
      if (!opts.silentError) toastError(e)
      opts.onError?.(e, v)
    },
  })
}

/** Helper to call an endpoint and keep warnings (for useMut). */
export const withWarnings = requestFull
