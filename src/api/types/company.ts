// JSON shapes of the API (backend/app/routes/company.py). Types only — the backend is the source of truth.
import type * as B from '@/types/business'

export interface AuditResult {
  items: AuditRow[]
  total: number
  page: number
  page_size: number
  entities: { value: string; label: string; count: number }[]
  actors: PersonLite[]
}

export interface AuditRow {
  id: string
  at: string
  actor: PersonLite | null
  source: AuditSource
  entity: string
  entity_label: string
  entity_id: string
  action: string
  summary: string
  before: string | null
  after: string | null
  link: string | null
}

export interface PersonLite {
  id: string
  name: string
  title: string
  hue: number
}

/* ================================================================== */
/* Audit trail                                                         */
/* ================================================================== */
export type AuditSource = 'activity' | 'project_status' | 'deal_stage' | 'task_review' | 'admin'

export interface InboxItem {
  id: string // `${kind}:${entity_id}:${stage}`
  kind: InboxKind
  group: InboxGroup
  stage: 'approve' | 'pay' | 'review' | 'read'
  entity_id: string
  version: number
  title: string
  subtitle: string
  requester: PersonLite | null
  amount: number | null // paise
  submitted_at: string | null
  due_at: string | null // ISO date
  overdue: boolean
  days_waiting: number
  link: string
  screen: string // owning screen, for "Open in …"
  actions: InboxAction[]
  bulk: boolean // eligible for bulk approval (no warnings, supported kind)
  warnings: string[]
  facts: InboxFact[]
  note: string | null // the requester's own words (reason, description, submission note)
  via_delegation?: boolean
  week_start?: string
  user_id?: string
  task_id?: string
  /** "Step 2 of 2 · CEO approval" on multi-step workflow items */
  step_label?: string | null
  /** Who the item escalates to when its step deadline passes */
  escalates_to?: string | null
}

/* ================================================================== */
/* Approvals inbox                                                     */
/* ================================================================== */
export type InboxKind = 'timesheet' | 'unlock' | 'task_review' | 'leave' | 'expense' | 'purchase_order' | 'vendor_bill' | 'appraisal' | 'change_request' | 'document' | 'change' | 'workflow'

export type InboxGroup = 'timesheets' | 'tasks' | 'leave' | 'expenses' | 'purchases' | 'bills' | 'appraisals' | 'changes' | 'other'

export type InboxAction = 'approve' | 'reject' | 'pay' | 'send_back' | 'open'

export interface InboxFact {
  label: string
  value: string | number | null
  type: FactType
  tone?: 'danger' | 'warning' | 'success'
}

export type FactType = 'text' | 'money' | 'date' | 'datetime' | 'hours' | 'number' | 'days'

export interface InboxView {
  items: InboxItem[]
  counts: Record<InboxGroup | 'all' | 'overdue', number>
  sla_days: number
  bulk_enabled: boolean
  can_pay_expenses: boolean
}

/* ================================================================== */
/* Goals & OKRs                                                        */
/* ================================================================== */
export type KRMetric = B.KeyResult['metric']

export interface MyRequest {
  id: string
  kind: InboxKind
  title: string
  subtitle: string
  state: RequestState
  state_label: string
  submitted_at: string | null
  decided_at: string | null
  decided_by: string | null
  waiting_on: string | null
  reason: string | null
  amount: number | null
  link: string
}

/* ---------------- "My requests" ---------------- */
export type RequestState = 'pending' | 'approved' | 'rejected' | 'paid' | 'draft' | 'cancelled' | 'sent_back'

export interface OkrView {
  period: OkrPeriod
  periods: OkrPeriod[]
  elapsed: number
  days_left: number
  objectives: ObjectiveView[]
  scorecard: { objectives: number; progress: number | null; on_track: number; at_risk: number; off_track: number; done: number; company_progress: number | null; krs: number }
  owners: PersonLite[]
  can: { company: boolean; team: boolean; person: boolean }
}

export interface OkrPeriod {
  label: string
  from: string
  to: string
  current: boolean
}

export interface ObjectiveView extends B.Objective {
  owner: PersonLite | null
  parent_title: string | null
  key_results: KRView[]
  progress: number | null
  expected: number
  computed_status: OkrStatus
  can_edit: boolean
}

export interface KRView extends B.KeyResult {
  owner: PersonLite | null
  auto: boolean
  kind: 'money' | 'percent' | 'number'
  progress: number | null // 0..1
  basis: string | null // what window / scope the auto value covers
  forecast: number | null // money metrics: expected by period end
  redacted: boolean
  checkins: CheckIn[]
  can_edit: boolean
  can_check_in: boolean
}

export interface CheckIn {
  id: string
  at: string
  by: string
  summary: string
}

export type OkrStatus = 'on_track' | 'at_risk' | 'off_track' | 'done' | 'not_started'
