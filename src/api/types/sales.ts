// JSON shapes of the API (backend/app/routes/sales.py). Types only — the backend is the source of truth.
import type { SalesLogKind } from '@/domain/sales'
import type { PeriodKind } from '@/domain/calendar'
import type * as E from '@/types/entities'
import type { PendingBrief } from './makerChecker'

export type { PendingBrief }

export interface ActivityLog {
  from: string
  to: string
  items: ActivityLogItem[]
  people: { user_id: string; name: string; count: number }[]
  total: number
  by_kind: Partial<Record<SalesLogKind, number>>
}

export interface ActivityLogItem {
  id: string
  date: string
  at: string
  who_id: string
  who_name: string
  deal_id: string
  deal_title: string
  client: string
  kind: SalesLogKind
  what: string
  detail: string
}

export interface CompensationResult {
  kind: PeriodKind
  from: string
  to: string
  label: string
  /** months counted (months still to come are left out) */
  months: string[]
  month: string
  threshold_pct: number
  variable_default_pct: number
  scope: 'team' | 'self'
  can_edit: boolean
  people: CompPerson[]
  /** sales_cost = base salary + variable pay earned (= payout), Feature Guide §12; ratio = closed ÷ sales_cost. ctc kept for reference. */
  totals: { ctc: number; base: number; variable: number; target: number; achieved: number; closed: number; variable_earned: number; payout: number; sales_cost: number; ratio: number | null }
  /** salary_cost = CTC (reference); sales_cost = base + variable earned; ratio = closed ÷ sales_cost */
  trend: { month: string; label: string; salary_cost: number; payout: number; sales_cost: number; closed: number; ratio: number | null }[]
}

export interface CompPerson {
  user_id: string
  name: string
  title: string
  has_rate: boolean
  /** current rate (end of period) */
  monthly_ctc: number
  variable_pct: number
  monthly_target: number
  target_is_default: boolean
  /** sums over the counted months of the period */
  ctc_in_period: number
  base_in_period: number
  target_in_period: number
  closed: number
  achievement: number | null
  variable_earned: number
  payout: number
  months_hit: number
  deals: { id: string; title: string; client: string; value: number; won_on: string }[]
  months: CompMonth[]
  history: CompMonth[]
  pending_change: PendingBrief | null
  /** effective date a Save would use (new cost-rate row) */
  next_effective_from: string | null
  // compat with the old month view
  month: string
  label: string
  base: number
  variable: number
  target: number
  achieved: number
  hit: boolean
}

export interface CompMonth {
  month: string
  label: string
  monthly_ctc: number
  base: number
  variable: number
  target: number
  achieved: number
  achievement: number
  variable_earned: number
  payout: number
  hit: boolean
}

export interface DealDetail {
  deal: DealView
  timeline: TimelineItem[]
  activity_count: number
  can_edit: boolean
  can_delete: boolean
  can_reopen: boolean
  can_create_project: boolean
}

export interface DealView extends DealRow {
  owner_name: string
  created_by_name: string
  /** one-time + 12 × recurring */
  deal_value_paise: number
  weighted_paise: number
  probability: number
  opened_on: string
  stage_entered_on: string
  days_in_stage: number
  days_in_pipeline: number
  days_since_activity: number
  stale: boolean
  next_step_overdue: boolean
  project: { id: string; code: string; name: string; status: E.ProjectStatus } | null
}

/* ------------------------------------------------------------------ */
/* Types shared with src/api/sales.ts                                  */
/* ------------------------------------------------------------------ */
/** Deal row as stored (next step and first conversation are optional entity fields). */
export type DealRow = E.Deal

export type TimelineItem =
  | { kind: 'stage'; id: string; at: string; by: string; by_name: string; from_stage: E.DealStage | null; to_stage: E.DealStage; reason: string | null }
  | { kind: 'activity'; id: string; at: string; date: string; by: string; by_name: string; type: E.ActivityType; note: string }

export interface SalesPerformance {
  from: string
  to: string
  label: string
  people: PersonPerformance[]
  team: Omit<PersonPerformance, 'user_id' | 'name' | 'role'>
  cost_vs_closed: { month: string; label: string; cost: number; closed: number; ratio: number | null }[]
  target_vs_achieved: { user_id: string; name: string; months: { month: string; label: string; target: number; achieved: number; hit: boolean }[] }[]
  last_six: { user_id: string; name: string; can_see_pay: boolean; months: SixMonthRow[] }[]
  funnel: { stage: E.DealStage; label: string; reached: number; value: number; conversion: number | null }[]
  activity_heat: { date: string; counts: Record<E.ActivityType, number>; total: number }[]
  can_see_cost: boolean
}

export interface PersonPerformance {
  user_id: string
  name: string
  role: E.Role
  calls: number
  meetings: number
  demos: number
  emails: number
  whatsapp: number
  proposals: number
  follow_ups: number
  activities: number
  new_leads: number
  won_count: number
  won_value: number
  lost_count: number
  win_rate: number | null
  avg_deal: number | null
  cycle_days: number | null
  open_value: number
  weighted_value: number
  open_count: number
  stale: number
  target: number | null
  achievement: number | null
}

export interface SixMonthRow {
  month: string
  label: string
  activities: number
  new_leads: number
  closed: number
  target: number | null
  achievement: number | null
  hit: boolean | null
  variable_earned: number | null
}

export interface SalesSummary {
  open_value: number
  weighted_value: number
  open_count: number
  won_value: number
  won_count: number
  lost_count: number
  win_rate: number | null
  avg_deal: number | null
  avg_cycle_days: number | null
  stale_count: number
  by_stage: Record<E.DealStage, { count: number; value: number; weighted: number }>
  stale_days: number
  // G11.02
  quarter_label: string
  won_quarter_value: number
  won_quarter_count: number
  forecast_quarter: number
  forecast_quarter_count: number
  win_rate_180: number | null
  won_180: number
  lost_180: number
  median_cycle_days: number | null
  recurring_won_monthly: number
  new_leads_month: number
  month_label: string
  activities_week: number
  week_from: string
  week_to: string
  followups_overdue: number
  // G11.03 — current stage of each deal
  funnel: FunnelStage[]
  lost: FunnelStage
}

export interface FunnelStage { stage: E.DealStage; label: string; count: number; value: number }
