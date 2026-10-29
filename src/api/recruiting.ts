// v9 (A3) — openings with job descriptions + public apply links, the public careers API, teams and the team overview.
// Backend: app/routes/recruiting.py, app/routes/teams.py, app/routes/docs_v7.py (GET /employee-docs/teams).
import { API_BASE, ApiError, http, requestFull } from './http'
import type { Opening } from '@/types/entities'
import type { EmployeeSummaryRow } from './docs'

/* ---------------- openings ---------------- */
export interface OpeningView extends Opening {
  project_code: string | null
  project_name: string | null
  /** present once the opening has a public link */
  public_url?: string
  accepting_now?: boolean
  applications?: number
}
export type JobDescription = Pick<
  Opening,
  'about' | 'responsibilities' | 'requirements' | 'nice_to_have' | 'location' | 'work_mode' | 'employment_type' | 'experience_min' | 'experience_max' | 'salary_min_paise' | 'salary_max_paise' | 'salary_visible' | 'accepting_applications'
>
export type OpeningInput = Pick<Opening, 'role' | 'project_id' | 'count' | 'status' | 'owner_id' | 'needed_by' | 'notes'> & JobDescription & { publish_link?: boolean }

export const WORK_MODE: Record<NonNullable<Opening['work_mode']>, string> = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }
export const EMPLOYMENT_TYPE: Record<NonNullable<Opening['employment_type']>, string> = { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', internship: 'Internship' }
/** statuses whose public link takes applications (with accepting_applications not switched off) — same rule as the API */
export const ACCEPTING_STATUSES: Opening['status'][] = ['open', 'interviewing']

export const recruitingApi = {
  openings: () => http.get<OpeningView[]>('/openings'),
  addOpening: (b: Partial<OpeningInput>) => requestFull<OpeningView>('POST', '/openings', { body: b }),
  updateOpening: (id: string, b: Partial<OpeningInput>, version?: number) => requestFull<OpeningView>('PATCH', `/openings/${id}`, { body: b, ifMatch: version }),
  deleteOpening: (id: string) => requestFull<null>('DELETE', `/openings/${id}`),
  publicLink: (id: string, regenerate = false) => requestFull<OpeningView>('POST', `/openings/${id}/public-link`, { body: { regenerate } }),
}

export const linkedInShareUrl = (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

/* ---------------- public careers page (no session: no Authorization header is sent) ---------------- */
export interface PublicOpening {
  company: { name: string; logo_data_url: string | null; website: string | null; primary: string | null }
  opening: {
    role: string
    count: number
    about: string
    responsibilities: string[]
    requirements: string[]
    nice_to_have: string[]
    location: string
    work_mode: Opening['work_mode']
    employment_type: Opening['employment_type']
    experience_min: number | null
    experience_max: number | null
    salary_min_paise: number | null
    salary_max_paise: number | null
    posted_on: string
  }
  accepting: boolean
  closed_reason: 'filled' | 'paused' | 'closed' | null
  max_resume_mb: number
}
export interface Application {
  name: string
  email: string
  phone: string
  linkedin_url: string
  current_company: string
  current_title: string
  experience_years: number | ''
  notice_days: number | ''
  expected_ctc_paise: number | null
  location: string
  cover_note: string
  consent: boolean
  resume: { name: string; mime: string; size_bytes: number; data_url: string } | null
  /** honeypot — people never see or fill it */
  website: string
}

async function publicCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, { method, cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check your connection and try again.')
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string; field?: string } }
  if (!res.ok) {
    const e = json.error ?? {}
    const retry = Number(res.headers.get('Retry-After'))
    const fallback = res.status === 429 ? `Too many attempts. Try again in ${retry > 60 ? `${Math.ceil(retry / 60)} minutes` : 'a minute'}.` : res.status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : `Request failed (${res.status}).`
    throw new ApiError(res.status, e.code ?? 'HTTP_' + res.status, e.message ?? fallback, e.field)
  }
  return json.data as T
}
export const careersApi = {
  get: (token: string) => publicCall<PublicOpening>('GET', `/public/openings/${encodeURIComponent(token)}`),
  apply: (token: string, b: Application) => publicCall<{ received: boolean; role: string }>('POST', `/public/openings/${encodeURIComponent(token)}`, b),
}

/* ---------------- teams ---------------- */
export interface Team {
  id: string
  tenant_id: string
  version: number
  created_at: string
  updated_at: string
  name: string
  description: string
  lead_id: string | null
  department_id: string | null
  member_ids: string[]
  active: boolean
}
export interface TeamView extends Team {
  lead_name: string | null
  department_name: string | null
  member_count: number
  active_member_count: number
}
export type TeamInput = Pick<Team, 'name' | 'description' | 'lead_id' | 'department_id' | 'member_ids'> & { active?: boolean }

export type WeekStatus = 'open' | 'submitted' | 'approved' | 'rejected' | 'locked' | 'missing' | 'not_started' | 'not_due'
export interface WeekFacts {
  week_start: string
  status: WeekStatus
  week_id: string | null
  submitted_at: string | null
  late: boolean
  hours: number
  target: number
  target_to_date: number
  short_days: number
  days: { date: string; hours: number; working: boolean; leave: 'full' | 'half' | null; target: number; short: boolean }[]
}
export interface TeamMember {
  id: string
  name: string
  title: string
  employee_code: string | null
  email: string
  phone: string | null
  avatar_hue: number
  manager_id: string | null
  manager_name: string | null
  location: string | null
  department: string | null
  joined_on: string
  is_lead: boolean
  /** null when the viewer may not see this person's timesheet */
  week: WeekFacts | null
}
export interface TeamGroupTotals {
  members: number
  visible: number
  approved: number
  submitted: number
  draft: number
  not_started?: number
  missing: number
  short_people: number
  hours: number
  target: number
  target_to_date: number
}
export interface TeamGroup {
  id: string
  kind: 'team' | 'department' | 'unassigned'
  name: string
  description: string
  lead_id: string | null
  lead_name: string | null
  department_name: string | null
  members: TeamMember[]
  totals: TeamGroupTotals
}
export interface TeamOverview {
  week_start: string
  this_week: string
  mode: 'teams' | 'departments'
  min_hours_per_day: number
  can_manage: boolean
  groups: TeamGroup[]
  totals: { groups: number; people: number; hours: number; target_to_date: number; missing: number; awaiting_approval: number; short_people: number }
}

export interface TeamDocGroup {
  id: string
  kind: 'team' | 'department' | 'unassigned'
  name: string
  lead_name: string | null
  people: EmployeeSummaryRow[]
  totals: { people: number; docs: number; verified: number; pending: number; missing_people: number; expiring: number; issued: number }
}

export const teamsApi = {
  list: () => http.get<TeamView[]>('/teams'),
  create: (b: TeamInput) => requestFull<TeamView>('POST', '/teams', { body: b }),
  update: (id: string, b: Partial<TeamInput>, version?: number) => requestFull<TeamView>('PATCH', `/teams/${id}`, { body: b, ifMatch: version }),
  remove: (id: string, version?: number) => requestFull<null>('DELETE', `/teams/${id}`, { ifMatch: version }),
  overview: (week?: string) => http.get<TeamOverview>('/teams/overview', week ? { week } : undefined),
  teamDocs: () => http.get<{ mode: 'teams' | 'departments'; groups: TeamDocGroup[] }>('/employee-docs/teams'),
}
