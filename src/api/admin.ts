// Module A — typed client + hooks for people, settings, holidays, cost rates, delegations,
// security, data export, onboarding, billing and the platform console.
import { http } from './http'
import { useApi } from './query'
import type { Proposed } from './changes'
import type { UserRow } from '@/api/types/people'
import type { BillingInvoice, CostRate, DataExport, Delegation, Grant, Holiday, Industry, Invite, Plan, Role, Subscription, Tenant, TenantSettings, TenantStatus, User } from '@/types/entities'

/* ---------- types ---------- */
export interface InviteRow extends Invite {
  status: 'pending' | 'expired' | 'accepted'
  link: string
  role_name: string
}
/** v4: job fields need employees.edit; access fields (role_key, extra/revoked permissions) need users.manage and are maker-checked. */
export interface UserPatch {
  reports_to_id?: string | null
  title?: string
  name?: string
  role_key?: string
  extra_permissions?: string[]
  revoked_permissions?: string[]
  // v5 team roster (Feature Guide §16)
  department_id?: string | null
  joined_on?: string
  productive_hours?: number | null
}
export interface BulkRowIn {
  name: string
  email: string
  role: string
  reports_to_email: string
}
export interface BulkRowOut {
  line: number
  name: string
  email: string
  role: Role
  role_key: string
  role_name: string
  reports_to_id: string | null
  errors: string[]
}
export interface BulkResult {
  rows: BulkRowOut[]
  valid: number
  invalid: number
  committed: boolean
}
export interface SettingRule {
  kind: 'num' | 'bool' | 'enum' | 'time' | 'text' | 'days' | 'weeks' | 'fixed'
  label: string
  min?: number
  max?: number
  step?: number
  values?: (string | number)[]
}
export interface SettingsPayload {
  tenant: Tenant
  time_zones: string[]
  /** v5: validation rules (allowed range) and defaults for every setting (Feature Guide §16) */
  rules?: Record<string, SettingRule>
  defaults?: TenantSettings
  calendar_stats?: { fy_label: string; avg_working_days: number }
}
export interface HolidayYear {
  year: number
  holidays: Holiday[]
  months: { month: string; working_days: number }[]
  years: string[]
}
export interface HolidayImportRow {
  line: number
  date: string
  name: string
  optional: boolean
  errors: string[]
}
export interface CostRateHistory extends CostRate {
  locked: boolean
  cost_per_hour_paise: number | null
}
export interface CostRatePerson {
  user_id: string
  status: User['status']
  current: CostRate | null
  upcoming: CostRate | null
  cost_per_hour_paise: number | null
  variable_paise: number | null
  history: CostRateHistory[]
}
export interface CostRatesPayload {
  month: string
  working_days: number
  min_hours: number
  locked_through: string | null
  can_edit: boolean
  people: CostRatePerson[]
  total_ctc_paise: number
}
export interface SessionRow {
  id: string
  created_at: string
  current: boolean
}
export interface OnboardingStep {
  key: 'settings' | 'holidays' | 'people' | 'project' | 'timesheet'
  title: string
  body: string
  to: string
  done: boolean
}
export interface OnboardingState {
  steps: OnboardingStep[]
  done: number
  total: number
  complete: boolean
  dismissed: boolean
  /** Backend flag for an optional sample-data loader; the UI never offers it (no fake records). */
  can_load_sample?: boolean
  tenant_age_days: number
}
export interface Quote {
  plan_code: string
  seats: number
  unit_paise: number
  subtotal_paise: number
  gst_paise: number
  total_paise: number
}
export interface BillingState {
  tenant: Pick<Tenant, 'id' | 'name' | 'status' | 'trial_ends_on' | 'plan_code' | 'seats'>
  subscription: Subscription
  plan: Plan
  plans: Plan[]
  gst_pct: number
  seats_used: number
  /** THE seat limit (purchased seats; a trial includes at least the trial plan's limit) — same rule as adding people */
  seat_limit: number
  next_charge: Quote | null
  invoices: BillingInvoice[]
  /** Online payment set-up. Absent or `enabled: false` → no pay buttons (the workspace contacts support). */
  payments?: PaymentsConfig
}
export interface PaymentsConfig {
  enabled: boolean
  provider: 'razorpay' | null
  /** Razorpay public key id (safe to expose). */
  key_id?: string
  /** Where to ask for a plan change when online payment is not set up. */
  support_email?: string
}
/** POST /billing/payments/order: `{plan_code, seats}` buys a plan; `{invoice_id}` pays a due billing invoice (e.g. the
 *  pro-rata invoice for extra seats from POST /billing/seats). The amount always comes from the server. */
export type PaymentOrderInput = { plan_code: string; seats: number } | { invoice_id: string }
export interface PaymentOrder {
  order_id: string
  provider?: string
  amount_paise: number
  currency: string
  key_id: string
  name?: string
  description?: string
  invoice?: BillingInvoice
  purpose?: 'plan' | 'seats'
  plan_code?: string
  seats?: number
}
export interface PaymentVerifyInput {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}
export interface PaymentVerifyResult {
  tenant?: Tenant
  invoice?: BillingInvoice | null
  subscription?: Subscription
  payment_id?: string | null
  status?: 'paid'
  already_paid?: boolean
  message?: string
}
export interface TenantAdminRow {
  id: string
  name: string
  slug: string
  status: TenantStatus
  industry: Industry
  plan_code: string
  plan_name: string
  seats: number
  /** THE seat limit (same rule as the billing page and adding people) */
  seat_limit: number
  users_active: number
  users_total: number
  created_at: string
  trial_ends_on: string | null
  trial_days_left: number | null
  subscription_status: Subscription['status'] | null
  period_end: string | null
  mrr_paise: number
  last_activity_at: string | null
}
export interface PlatformKpis {
  total: number
  trial: number
  active: number
  read_only: number
  suspended: number
  mrr_paise: number
  gst_pct: number
  seats_paid: number
  trials_ending_7d: number
}
export interface AuditRow {
  id: string
  actor_id: string
  actor_name: string
  tenant_id: string
  tenant_name: string
  action: string
  reason: string
  at: string
}

/* ---------- client ---------- */
export const adminApi = {
  // people
  // people — v4 user rows, Create employee and access changes live in ./access (accessApi)
  users: () => http.get<UserRow[]>('/users'),
  updateUser: (id: string, patch: UserPatch, version?: number) => http.full<{ user: UserRow; access: Proposed<UserRow> | null }>('PATCH', `/users/${id}`, { body: patch, ifMatch: version }),
  deactivate: (id: string) => http.full<Proposed<UserRow>>('POST', `/users/${id}/deactivate`),
  reactivate: (id: string) => http.full<UserRow>('POST', `/users/${id}/reactivate`),
  invites: () => http.get<InviteRow[]>('/invites'),
  invite: (b: { name: string; email: string; role_key: string; reports_to_id: string | null }) => http.post<InviteRow>('/users/invite', b),
  bulkInvite: (rows: BulkRowIn[], mode: 'preview' | 'commit') => http.post<BulkResult>('/users/bulk-invite', { rows, mode }),
  resendInvite: (id: string) => http.post<InviteRow>(`/invites/${id}/resend`),
  revokeInvite: (id: string) => http.del(`/invites/${id}`),
  // settings
  settings: () => http.get<SettingsPayload>('/settings'),
  saveSettings: (b: { settings: Partial<TenantSettings>; tenant: Partial<Pick<Tenant, 'name' | 'time_zone' | 'industry'>> }, version: number) => http.full<Proposed<Tenant>>('PUT', '/settings', { body: b, ifMatch: version }),
  // holidays
  holidays: (year: number) => http.get<HolidayYear>('/holidays', { year }),
  addHoliday: (b: { date: string; name: string; optional: boolean }) => http.full<Holiday>('POST', '/holidays', { body: b }),
  updateHoliday: (id: string, b: { date: string; name: string; optional: boolean }, version?: number) => http.full<Holiday>('PATCH', `/holidays/${id}`, { body: b, ifMatch: version }),
  deleteHoliday: (id: string) => http.del(`/holidays/${id}`),
  importHolidays: (rows: { date: string; name: string; optional?: string }[], mode: 'preview' | 'commit') => http.post<{ rows: HolidayImportRow[]; valid: number; invalid: number; committed: boolean }>('/holidays/import', { rows, mode }),
  // cost rates
  costRates: () => http.get<CostRatesPayload>('/cost-rates'),
  addCostRate: (b: { user_id: string; monthly_ctc_paise: number; variable_pct: number; sales_target_paise: number | null; effective_from: string }) => http.full<CostRate>('POST', '/cost-rates', { body: b }),
  deleteCostRate: (id: string) => http.del(`/cost-rates/${id}`),
  // delegations
  delegations: () => http.get<Delegation[]>('/delegations'),
  addDelegation: (b: { from_user_id: string; to_user_id: string; from_on: string; to_on: string; reason: string; project_id?: string | null; include_tasks?: boolean }) => http.post<Delegation>('/delegations', b),
  deleteDelegation: (id: string) => http.del(`/delegations/${id}`),
  // security
  sessions: () => http.get<SessionRow[]>('/sessions'),
  revokeOthers: () => http.post<{ revoked: number }>('/sessions/revoke-others'),
  revokeSession: (id: string) => http.del(`/sessions/${id}`),
  twoFactorSetup: () => http.post<{ secret: string; otpauth_url: string }>('/me/2fa/setup'),
  twoFactorStatus: () => http.get<{ enabled: boolean; enabled_at: string | null; recovery_codes_left: number }>('/me/2fa'),
  twoFactorVerify: (code: string) => http.post<{ user: User; recovery_codes: string[] }>('/me/2fa/verify', { code }),
  /** password, or a current 6-digit code from the authenticator app */
  twoFactorDisable: (proof: { password: string } | { code: string }) => http.post<User>('/me/2fa/disable', proof),
  twoFactorNewCodes: (code: string) => http.post<{ recovery_codes: string[] }>('/me/2fa/recovery-codes', { code }),
  avatar: (hue: number) => http.patch<User>('/me/avatar', { hue }),
  resetInfo: (token: string) => http.get<{ min_length: number; email_hint: string; expires_in_minutes: number }>(`/auth/reset-info/${token}`),
  // data export
  exports: () => http.get<DataExport[]>('/exports'),
  requestExport: () => http.post<DataExport>('/exports'),
  downloadExport: (id: string) => http.get<{ generated_at: string; tenant: Record<string, unknown>; tables: Record<string, Record<string, unknown>[]> }>(`/exports/${id}/download`),
  // onboarding
  onboarding: () => http.get<OnboardingState>('/onboarding'),
  dismissOnboarding: () => http.post('/onboarding/dismiss'),
  restoreOnboarding: () => http.post('/onboarding/restore'),
  // billing
  billing: () => http.get<BillingState>('/billing'),
  quote: (plan_code: string, seats: number) => http.post<Quote>('/billing/quote', { plan_code, seats }),
  paymentOrder: (b: PaymentOrderInput) => http.post<PaymentOrder>('/billing/payments/order', b),
  paymentVerify: (b: PaymentVerifyInput) => http.post<PaymentVerifyResult>('/billing/payments/verify', b),
  /** fewer seats apply at once; more seats return a due pro-rata invoice to pay first (`payment_required`) */
  seats: (seats: number) => http.post<{ tenant: Tenant; invoice: BillingInvoice | null; payment_required?: boolean }>('/billing/seats', { seats }),
  // platform
  tenants: () => http.get<{ tenants: TenantAdminRow[]; kpis: PlatformKpis }>('/admin/tenants'),
  extendTrial: (id: string, days: number, reason: string) => http.post<TenantAdminRow>(`/admin/tenants/${id}/extend`, { days, reason }),
  suspend: (id: string, reason: string) => http.post<TenantAdminRow>(`/admin/tenants/${id}/suspend`, { reason }),
  reactivateTenant: (id: string, reason: string) => http.post<TenantAdminRow>(`/admin/tenants/${id}/reactivate`, { reason }),
  audit: () => http.get<AuditRow[]>('/admin/audit'),
}

/* ---------- hooks ---------- */
export const useUsers = () => useApi(['users'], adminApi.users)
export const useInvites = () => useApi(['invites'], adminApi.invites)
export const useSettings = () => useApi(['settings'], adminApi.settings)
export const useHolidays = (year: number) => useApi(['holidays', year], () => adminApi.holidays(year))
export const useCostRates = () => useApi(['cost-rates'], adminApi.costRates)
export const useDelegations = () => useApi(['delegations'], adminApi.delegations)
export const useSessions = () => useApi(['sessions'], adminApi.sessions)
export const useExports = () => useApi(['exports'], adminApi.exports)
export const useOnboarding = (enabled = true) => useApi(['onboarding'], adminApi.onboarding, { enabled })
export const useBilling = () => useApi(['billing'], adminApi.billing)
export const usePlatformTenants = () => useApi(['admin-tenants'], adminApi.tenants)
export const usePlatformAudit = () => useApi(['admin-audit'], adminApi.audit)

/* ---------------- v5: team roster (Feature Guide §16) ---------------- */
export interface RosterPerson {
  id: string
  version: number
  status: User['status']
  name: string
  title: string
  avatar_hue: number
  employee_code: string | null
  role_key: string
  role_name: string
  persona: Role
  department_id: string | null
  department_name: string | null
  department_kind: User['department']
  joined_on: string
  reports_to_id: string | null
  reports_to_name: string | null
  self_approves: boolean
  productive_hours: number | null
  effective_productive_hours: number
  monthly_ctc_paise: number | null
  variable_pct: number | null
  cost_per_day_paise: number | null
  pending_ctc: import('@/api/types/makerChecker').PendingBrief | null
}
export interface RosterView {
  people: RosterPerson[]
  avg_working_days: number
  cost_loading_pct: number
  default_productive_hours: number
  min_hours: number
  departments: { id: string; name: string }[]
  roles: { key: string; name: string; persona: Role }[]
  can_edit: boolean
  can_edit_access: boolean
  can_see_ctc: boolean
  can_edit_ctc: boolean
}
export const rosterApi = {
  roster: () => http.get<RosterView>('/team-roster'),
}
export const useRoster = () => useApi(['team-roster'], rosterApi.roster)

/* v5: delegation scope options (Feature Guide §16) */
export const useDelegationOptions = () => useApi(['delegations', 'options'], () => http.get<{ projects: { id: string; code: string; name: string }[]; can_manage_all: boolean }>('/delegations/options'))
