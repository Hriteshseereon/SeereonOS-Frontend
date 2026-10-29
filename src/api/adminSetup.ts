// v9 admin settings (A5, D10): leave types & policies, holiday calendars, financial-year opening balances, role
// compare / who-has-it and the admin setup hub. Every rule and number lives in the backend
// (backend/app/routes/admin_setup.py, backend/app/routes/access.py); this file is types + calls + hooks.
import { http } from './http'
import { useApi } from './query'
import type { Proposed } from './changes'
import type { Holiday } from '@/types/entities'
import type { PendingBrief } from './changes'

/* ---------------- leave types & policies ---------------- */
export type Accrual = 'monthly' | 'upfront' | 'annual'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export interface LeaveTypeRow {
  code: string
  name: string
  builtin: boolean
  is_custom: boolean
  /** a policy row exists (built-ins without one have no quota — v8 behaviour) */
  configured: boolean
  /** lwp is always available and has no policy */
  configurable: boolean
  usage: { requests: number; pending: number; days_fy: number; records: number }
  in_use: boolean
  id: string | null
  version: number | null
  active: boolean
  description: string
  annual_days: number | null
  accrual: Accrual | null
  carry_forward_max: number | null
  encashable: boolean
  encash_max_days: number | null
  applicable_role_keys: string[]
  applicable_location_ids: string[]
  applicable_employment_types: EmploymentType[]
  /** null = never; 0 = always; N = when a request is MORE than N days */
  attachment_after_days: number | null
  sort_order: number | null
  eligible_people: number
  updated_at?: string
}
export interface LeaveTypesView {
  types: LeaveTypeRow[]
  accruals: { value: Accrual; label: string }[]
  employment_types: { value: EmploymentType; label: string }[]
  roles: { key: string; name: string }[]
  locations: { id: string; name: string }[]
  people: number
  fy_label: string
  can_edit: boolean
}
export interface LeaveTypeInput {
  code?: string
  name: string
  description: string
  annual_days: number
  accrual: Accrual
  carry_forward_max: number
  encashable: boolean
  encash_max_days: number | null
  applicable_role_keys: string[]
  applicable_location_ids: string[]
  applicable_employment_types: EmploymentType[]
  attachment_after_days: number | null
  active: boolean
  sort_order?: number | null
}
/** GET /leave/options — the leave form's contract (A2): types the signed-in person may apply for. */
export interface LeaveOption {
  code: string
  name: string
  description: string
  has_quota: boolean
  annual_days: number | null
  accrual: Accrual | null
  balance: { type: string; annual: number; accrued: number; used: number; pending: number; remaining: number; accrual: Accrual } | null
  encashable: boolean
  attachment_after_days: number | null
  attachment_rule: string | null
}
export interface LeaveOptions {
  types: LeaveOption[]
  calendar: { id: string; name: string }
  optional_holidays: { date: string; name: string }[]
}
/** Does a request of `days` need a supporting document? (same rule as the server: >N days; 0 = always) */
export const attachmentRequired = (o: Pick<LeaveOption, 'attachment_after_days'> | null | undefined, days: number) =>
  !!o && o.attachment_after_days !== null && (o.attachment_after_days === 0 || days > o.attachment_after_days)

/* ---------------- holiday calendars ---------------- */
export interface HolidayCalendarRow {
  id: string
  name: string
  description: string
  is_default: boolean
  active: boolean
  version: number
  is_base: boolean
  holiday_count: number
  optional_count: number
  total_holidays: number
  location_ids: string[]
  locations: { id: string; name: string; explicit: boolean }[]
  people_count: number
}
export interface HolidayCalendarsView {
  year: number
  calendars: HolidayCalendarRow[]
  default_id: string
  my_calendar_id: string
  locations: { id: string; name: string; code: string; calendar_id: string; explicit: boolean }[]
  can_edit: boolean
}
export interface CalendarHolidays {
  year: number
  holidays: Holiday[]
  months: { month: string; working_days: number }[]
  years: string[]
  calendar_id: string
  calendar_name: string
  calendars: number
}
export interface HolidayImportRow {
  line: number
  date: string
  name: string
  optional: boolean
  errors: string[]
}

/* ---------------- opening balances ---------------- */
export type OpeningKind = 'cash' | 'bank' | 'ledger' | 'receivable' | 'payable'
export interface OpeningLine {
  id?: string
  kind: OpeningKind
  name: string
  side: 'debit' | 'credit'
  amount_paise: number
  category?: string
  party_id?: string | null
  party_name?: string | null
  reference?: string
  due_on?: string | null
  note?: string
}
export interface OpeningTotals {
  cash: number
  bank: number
  cash_bank: number
  ledger_debit: number
  ledger_credit: number
  receivables: number
  payables: number
  debits: number
  credits: number
  difference: number
  count: number
}
export interface OpeningsView {
  fy_start_year: number
  fy_label: string
  as_of: string
  fy_to: string
  id: string | null
  version: number | null
  exists: boolean
  lines: OpeningLine[]
  notes: string
  totals: OpeningTotals
  locked: boolean
  manual_lock: boolean
  has_transactions: boolean
  activity: { ledger_entries: number; invoices: number; payments: number; total: number }
  reopened: boolean
  lock_reason: string | null
  locked_at: string | null
  locked_by_name: string | null
  reopened_at: string | null
  reopened_by_name: string | null
  reopen_reason: string | null
  history: { at: string; by: string; by_name: string | null; approved_by_name?: string | null; action: string; reason?: string; totals?: Record<string, number> }[]
  pending: PendingBrief | null
  kinds: { value: OpeningKind; label: string }[]
  years: { fy_start_year: number; fy_label: string }[]
  parties: { customers: { id: string; name: string }[]; vendors: { id: string; name: string }[] }
  can_edit: boolean
  legacy_opening_cash_paise?: number | null
}

/* ---------------- roles: compare & who has it ---------------- */
export interface RoleCompare {
  roles: { key: string; name: string; count: number; user_count: number; active: boolean }[]
  modules: { module: string; label: string; differences: number; permissions: { key: string; label: string; description: string; sensitive: boolean; has: Record<string, boolean>; same: boolean }[] }[]
  summary: { common: number; differences: number; only: Record<string, number> }
}
export interface PermissionHolder {
  id: string
  name: string
  title: string
  email: string
  avatar_hue: number
  status: string
  role_key: string
  role_name: string | null
  via?: 'role' | 'extra'
}
export interface PermissionHolders {
  permission: { key: string; label: string; description: string; module: string; module_label: string; kind: string; sensitive?: boolean; requires?: string[]; required_by: string[] }
  roles: { key: string; name: string; active: boolean; is_system: boolean; user_count: number }[]
  people: PermissionHolder[]
  revoked: PermissionHolder[]
  total: number
}

/* ---------------- admin setup hub ---------------- */
export type HubStatus = 'done' | 'attention' | 'todo' | 'optional'
export interface HubItem {
  group: string
  key: string
  title: string
  body: string
  status: HubStatus
  meta: string
  to: string
  action: string
  required: boolean
}
export interface SetupHub {
  company: string
  groups: { title: string; items: HubItem[] }[]
  done: number
  total: number
  complete: boolean
  attention: number
}

export const adminSetupApi = {
  leaveTypes: () => http.get<LeaveTypesView>('/admin/leave-types'),
  createLeaveType: (b: LeaveTypeInput) => http.full<LeaveTypeRow>('POST', '/admin/leave-types', { body: b }),
  updateLeaveType: (code: string, b: Partial<LeaveTypeInput>, version?: number | null) => http.full<LeaveTypeRow>('PATCH', `/admin/leave-types/${encodeURIComponent(code)}`, { body: b, ifMatch: version ?? undefined }),
  deleteLeaveType: (code: string, version?: number | null) => http.full<{ ok: true }>('DELETE', `/admin/leave-types/${encodeURIComponent(code)}`, { ifMatch: version ?? undefined }),
  leaveOptions: () => http.get<LeaveOptions>('/leave/options'),

  calendars: (year: number) => http.get<HolidayCalendarsView>('/holiday-calendars', { year }),
  createCalendar: (b: { name: string; description: string; copy_from_id?: string | null; copy_year?: number | null }) => http.full<HolidayCalendarRow & { copied: number }>('POST', '/holiday-calendars', { body: b }),
  updateCalendar: (id: string, b: { name?: string; description?: string; active?: boolean }, version?: number) => http.full<HolidayCalendarRow>('PATCH', `/holiday-calendars/${id}`, { body: b, ifMatch: version || undefined }),
  deleteCalendar: (id: string, version?: number) => http.full<{ ok: true }>('DELETE', `/holiday-calendars/${id}`, { ifMatch: version || undefined }),
  makeDefault: (id: string) => http.full<{ ok: true }>('POST', `/holiday-calendars/${id}/default`, {}),
  assignLocations: (id: string, location_ids: string[]) => http.full<{ ok: true; added: string[]; removed: string[] }>('PUT', `/holiday-calendars/${id}/locations`, { body: { location_ids } }),
  holidays: (year: number, calendar_id?: string | null) => http.get<CalendarHolidays>('/holidays', calendar_id ? { year, calendar_id } : { year }),
  addHoliday: (b: { date: string; name: string; optional: boolean; calendar_id?: string | null }) => http.full<Holiday>('POST', '/holidays', { body: b }),
  updateHoliday: (id: string, b: { date: string; name: string; optional: boolean }, version?: number) => http.full<Holiday>('PATCH', `/holidays/${id}`, { body: b, ifMatch: version }),
  deleteHoliday: (id: string) => http.full<{ ok: true }>('DELETE', `/holidays/${id}`, {}),
  importHolidays: (rows: { date: string; name: string; optional?: string }[], mode: 'preview' | 'commit', calendar_id?: string | null) =>
    http.post<{ rows: HolidayImportRow[]; valid: number; invalid: number; committed: boolean }>('/holidays/import', { rows, mode, calendar_id: calendar_id || undefined }),

  openings: (fy?: number) => http.get<OpeningsView>('/finance/openings', fy ? { fy } : undefined),
  saveOpenings: (fy: number, b: { lines: OpeningLine[]; notes: string }, version?: number | null) => http.full<OpeningsView>('PUT', `/finance/openings/${fy}`, { body: b, ifMatch: version ?? undefined }),
  lockOpenings: (fy: number, version?: number | null) => http.full<OpeningsView>('POST', `/finance/openings/${fy}/lock`, { ifMatch: version ?? undefined }),
  reopenOpenings: (fy: number, reason: string) => http.full<Proposed<OpeningsView | null>>('POST', `/finance/openings/${fy}/reopen`, { body: { reason } }),

  compareRoles: (keys: string[]) => http.get<RoleCompare>('/roles-compare', { keys: keys.join(',') }),
  holders: (key: string) => http.get<PermissionHolders>(`/permissions/${encodeURIComponent(key)}/holders`),
  hub: () => http.get<SetupHub>('/setup/hub'),
}

export const useLeaveTypes = () => useApi(['leave-types'], adminSetupApi.leaveTypes)
export const useLeaveOptions = () => useApi(['leave-options'], adminSetupApi.leaveOptions)
export const useHolidayCalendars = (year: number) => useApi(['holiday-calendars', year], () => adminSetupApi.calendars(year))
export const useCalendarHolidays = (year: number, calendarId: string | null) => useApi(['holidays', year, calendarId ?? 'mine'], () => adminSetupApi.holidays(year, calendarId))
export const useOpenings = (fy?: number) => useApi(['openings', fy ?? 'current'], () => adminSetupApi.openings(fy))
export const useRoleCompare = (keys: string[]) => useApi(['roles-compare', keys.join(',')], () => adminSetupApi.compareRoles(keys), { enabled: keys.length >= 2 })
export const usePermissionHolders = (key: string | null) => useApi(['permission-holders', key ?? ''], () => adminSetupApi.holders(key!), { enabled: !!key })
export const useSetupHub = () => useApi(['setup-hub'], adminSetupApi.hub)
