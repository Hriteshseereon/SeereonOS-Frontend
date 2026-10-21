// JSON shapes of the API (backend/app/routes/dashboards.py). Types only — the backend is the source of truth.
import type { PeriodKind } from '@/domain/calendar'
import type * as E from '@/types/entities'
import type { Tone } from '@/domain/labels'

export interface CeoDashboard {
  period: { kind: PeriodKind; label: string; from: string; to: string; prev_label: string }
  revenue: { month: Money4 & { label: string; change: number | null; prev_label: string }; quarter: Money4 & { label: string; change: number | null; prev_label: string }; fy: Money4 & { label: string; change: number | null; prev_label: string } }
  period_rows: PeriodRow[]
  months: { key: string; label: string; billed: number; collected: number; cost: number; net: number }[]
  streams: { key: string; label: string; value: number }[]
  streams_label: string
  ahead: { in_30: number; in_60: number; in_90: number; uninvoiced: number; uninvoiced_count: number; weighted_pipeline: number; open_pipeline: number; total: number }
  projects: ProjectPill[]
  delivery: { milestones_on_time: number | null; milestones_achieved: number; milestones_on_time_count: number; spi: number | null; overdue_tasks: number; avg_lateness: number | null; late_tasks: number; blocked_tasks: number; tasks_on_time: number | null; done_4w: number; done_prev_4w: number; utilisation: number | null; at_risk_projects: number; active_projects: number }
  milestones_30: MilestoneRow[]
  milestones_30_total: number
  approvals: ApproverRow[]
  stale: { count: number; value: number; stale_days: number; deals: DealRowLite[] }
  cash: { balance: number; monthly_burn: number; recurring_income: number; net_burn: number; runway_months: number | null; cash_positive: boolean }
  can_margins: boolean
  /* v5 Feature Guide §2 */
  week: string
  /** Fixed period table: this month, this quarter, this financial year (to date), each against its previous period. */
  fixed_rows: (Money4 & { key: 'month' | 'quarter' | 'fy'; label: string; sub: string; change: number | null; change_label: string })[]
  /** Net earnings this FY to date vs the same days of last FY. */
  net_change: number | null
  stream_shares: { key: string; label: string; value: number; share: number }[]
  kpis: { cpi: number | null; forecast_breach: number; breached_open: number; red_projects: number; active_projects: number; team_score: number | null; on_time_tasks: number | null; done_week: number }
  cash_ms: { on_time: number | null; achieved: number; achieved_not_invoiced: number; invoiced_awaiting: number; billable_30: number }
  finance: {
    pnl: { key: string; label: string; billed: number; collected: number; cost: number; net: number }[]
    recurring: { id: string; kind: E.LedgerEntry['kind']; description: string; category: string; amount: number; until_on: string | null }[]
    top_expenses: { id: string; description: string; category: string; amount: number; date: string }[]
    month_income: number; month_expense: number
  }
}

export interface Money4 { billed: number; collected: number; cost: number; net: number; margin: number | null }

export interface PeriodRow extends Money4 { key: string; label: string; from: string; to: string; kind: 'sub' | 'total' | 'previous' }

export interface ProjectPill {
  id: string; code: string; name: string; client: string; status: E.ProjectStatus; health: Health; progress: number; spi: number | null; effort_ratio: number | null
  projected_margin: number | null; overdue_tasks: number; blocked_tasks: number; overdue_milestones: number; pm: string | null
  next_milestone: { id: string; label: string; planned_end: string; billing: number; days: number } | null
}

/* ------------------------------------------------------------------ */
/* Shared types (imported by src/api/dashboards.ts)                     */
/* ------------------------------------------------------------------ */
export type Health = 'on_track' | 'at_risk' | 'off_track'

export interface MilestoneRow {
  id: string; project_id: string; project: string; client: string; label: string; planned_end: string; days: number; state: string; progress: number; billing: number; billing_status: E.MilestoneBilling
  /** v5: milestone code (M4), name, P50 forecast finish and whether it passes the deadline. */
  code?: string; name?: string; forecast?: string | null; forecast_late?: boolean
}

export interface ApproverRow { id: string; name: string; hue: number; pending: number; overdue: number; late: number; on_time: number; decided: number; score: number }

export interface DealRowLite { id: string; title: string; client: string; stage: E.DealStage; owner: string | null; value: number; weighted: number; days_idle: number; expected_close: string; next_step: string | null; next_step_on: string | null }

export interface EmployeeDashboard {
  today: TaskRow[]
  week: TaskRow[]
  overdue: TaskRow[]
  blocked: TaskRow[]
  waiting_on_me: (TaskRow & { waiting: { id: string; title: string; owner: string | null }[] })[]
  timesheet: { week_start: string; status: E.WeekStatus | 'missing'; total: number; min_per_day: number; expected_to_date: number; days: { date: string; hours: number; working: boolean; min: number; future: boolean }[] }
  stats: { effort_ratio: number | null; on_time: number | null; done_4w: number; done_prev_4w: number; open: number; ratio_samples: number; allocation_10d: number }
  daily: { submitted_today: boolean; last_date: string | null; proof_required: boolean }
  /* v5 Feature Guide §1 employee view */
  viewed_week: string
  person: { id: string; name: string; title: string; hue: number }
  is_self: boolean
  /** People whose employee view this viewer may open (themselves first). */
  viewable: { id: string; name: string; title: string }[]
  mentions: MentionRow[]
  covering: CoveringRow[]
  numbers: { score: number | null; score_cells: ScoreCell[]; on_time: number | null; effort_ratio: number | null; utilisation: number | null; booked: number; capacity: number; open: number; overdue: number; avg_lateness: number | null; forecast_breach: number }
}

export interface TaskRow { id: string; code: string; title: string; project_id: string; project: string; owner_id: string | null; owner: string | null; owner_hue: number; status: E.TaskStatus; due_on: string; days: number; est: number; actual: number; reason?: string }

export interface MentionRow { id: string; task_id: string; task_code: string; task_title: string; project: string; tag: string | null; tag_tone: Tone | null; author: string; author_hue: number; at: string; body: string }

export interface CoveringRow extends TaskRow { for_name: string; why: string }

/* ------------------------------------------------------------------ */
/* Weekly scorecard (Feature Guide §15, prototype §9, §14)              */
/* ------------------------------------------------------------------ */
export interface ScoreCell { key: string; label: string; value: number | null; detail: string; weight: number }

export interface InsightResult {
  view: InsightViewId
  title: string
  explanation: string
  kpis: { label: string; value: number | null; format: 'number' | 'money' | 'percent' | 'ratio' | 'hours' | 'days'; tone?: Tone; hint?: string }[]
  columns: InsightColumn[]
  rows: Record<string, InsightCell>[]
  empty: string
  ask: string
  sections?: { title: string; subtitle?: string; columns: InsightColumn[]; rows: Record<string, InsightCell>[]; empty: string }[]
  weeks?: string[]
  /** Heading over the main table when the view has several tables. */
  main_title?: string
}

/* ------------------------------------------------------------------ */
/* Insights                                                              */
/* ------------------------------------------------------------------ */
export type InsightViewId = 'tasks_at_risk' | 'blocked' | 'overdue_milestones' | 'effort_ratio' | 'allocation' | 'timesheet_compliance' | 'approval_kpi' | 'stale_deals' | 'predictions' | 'estimation'

export interface InsightColumn { key: string; label: string; type: InsightColType; align?: 'left' | 'right' | 'center'; hideBelow?: 'md' | 'lg' | 'xl' }

export type InsightColType = 'string' | 'number' | 'money' | 'percent' | 'date' | 'hours' | 'days' | 'ratio' | 'person' | 'badge' | 'weeks' | 'task' | 'project' | 'chance' | 'deal'

export type InsightCell = string | number | boolean | null | (string | null)[]

export interface InsightTab { id: InsightViewId; label: string; count: number | null; group: 'delivery' | 'people' | 'sales' | 'prediction' }

export interface OpsDashboard {
  counts: { overdue: number; due_7: number; upcoming_30: number; openings: number; positions: number; on_leave_today: number }
  items: { id: string; item: string; category: E.OpsItem['category']; owner: string | null; due_on: string; days: number; recurring: E.Recurrence; group: 'overdue' | 'due' | 'upcoming' }[]
  compliance: { id: string; item: string; due_on: string; days: number; owner: string | null; status: 'open' | 'done' }[]
  openings: { id: string; role: string; project: string | null; count: number; status: E.Opening['status']; needed_by: string | null; owner: string | null }[]
  leave_today: { id: string; name: string; hue: number; type: E.LeaveType; portion: 'full' | 'half' }[]
  payroll: { month: string; label: string; status: 'not_started' | 'draft' | 'final'; run_id: string | null; last_month: { label: string; status: 'not_started' | 'draft' | 'final'; run_id: string | null } }
  timesheets: { missing_last_week: number; pending_approval: number; people: number }
}

export interface PmDashboard {
  projects: ProjectPill[]
  kpis: { active: number; at_risk: number; overdue_tasks: number; blocked: number; due_3d: number; pending_approvals: number; open_crs: number; compliance: number | null }
  at_risk: TaskRow[]
  blocked: TaskRow[]
  load: { dates: string[]; people: LoadRow[] }
  approvals: { id: string; person: string; hue: number; week_start: string; hours: number; submitted_at: string | null; due: string | null; overdue: boolean }[]
  change_requests: { id: string; project_id: string; project: string; title: string; status: E.CRStatus; hours: number; value: number | null; age_days: number }[]
  compliance: { id: string; name: string; hue: number; last_week: E.WeekStatus | 'missing'; weeks: (E.WeekStatus | 'missing')[]; pct: number }[]
  milestones: MilestoneRow[]
  /* v5 Feature Guide §14 */
  week: string
  control: {
    active_projects: number; critical_at_risk: number; blocked_waiting: number; past_start: number; open_bugs: number; in_testing: number; in_uat: number; waiting_feedback: number; no_estimate: number; conflicts: number
    critical_list: TaskRow[]; conflict_list: { id: string; task_id: string; kind: 'dependency' | 'double_booked'; message: string }[]
  }
  pipeline: { stage: E.TaskStage | 'in_review'; label: string; count: number; tone: Tone; group: string }[]
  done_count: number
  load_hours: { from: string; to: string; days: number; people: LoadHoursRow[] }
  due_week: number
  /** "Needs attention" (v7): what to act on right now, each with a count and the filtered screen it links to. */
  attention: { key: string; label: string; count: number; to: string; hint?: string }[]
}

export interface LoadRow { id: string; name: string; hue: number; title: string; avg: number; days: { date: string; pct: number }[] }

export interface LoadHoursRow { id: string; name: string; hue: number; title: string; booked: number; capacity: number; pct: number | null; double_booked: boolean; leave_days: number; open_tasks: number }

export interface SalesDashboard {
  scope: 'mine' | 'team'
  /** Whose target the target panel shows (team needs deals.view_all + cost_rates.view). */
  target_scope: 'mine' | 'team'
  summary: { open_value: number; weighted_value: number; open_count: number; won_value: number; won_count: number; win_rate: number | null; avg_cycle_days: number | null; stale_count: number }
  by_stage: { stage: E.DealStage; label: string; count: number; value: number; weighted: number }[]
  needs_action: (DealRowLite & { reason: 'stale' | 'closing' | 'next_step' | 'overdue_close'; reason_text: string })[]
  target: { month_label: string; target: number; achieved: number; achievement: number; threshold_pct: number; hit: boolean; variable: number; variable_earned: number; has_rate: boolean } | null
  history: { label: string; target: number; achieved: number; hit: boolean }[]
  activities: { id: string; date: string; type: E.ActivityType; deal_id: string; deal: string; client: string; note: string; by: string | null }[]
  activity_30d: number
}

export interface Scorecard {
  week: string; label: string; weeks: { week: string; label: string }[]; is_current: boolean; is_future: boolean
  team: { score: number | null; green: number; amber: number; red: number; none: number; trend: (number | null)[] }
  people: ScoreRow[]
  thresholds: { green: number; amber: number }
}

export interface ScoreRow {
  id: string; name: string; title: string; role: E.Role; role_name: string; hue: number; kind: 'delivery' | 'sales' | 'ops'
  cells: ScoreCell[]; score: number | null; trend: (number | null)[]; flags: string[]; red_twice: boolean; forecast_breach: number
}
/** GET /rules/score → weights (one entry per scorecard metric). */
export type ScoreWeights = Record<string, { label: string; weight: number; kind: ScoreRow['kind'] | 'all' | 'managers'; rule: string }>
