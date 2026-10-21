// JSON shapes of the API (backend/app/engine/analytics.py). Types only — the backend is the source of truth.
import type { Health } from '@/domain/costing'

/* ---------------- project financials (BR-23..26) ---------------- */
export interface ProjectMetrics {
  project_id: string
  est_hours: number
  actual_hours: number
  approved_hours: number
  remaining_hours: number
  progress: number // share of estimate done
  planned_cost: number
  actual_cost: number // approved hours only
  logged_cost: number // all logged hours
  projected_cost: number
  contract_value: number
  invoiced: number
  collected: number
  outstanding: number
  uninvoiced: number
  planned_margin: number | null
  projected_margin: number | null
  actual_margin: number | null
  planned_markup: number | null
  projected_markup: number | null
  actual_markup: number | null
  effort_ratio: number | null
  spi: number | null
  health: Health
  overdue_milestones: number
  open_tasks: number
  overdue_tasks: number
  blocked_tasks: number
  team: string[]
  next_milestone: { id: string; name: string; no: number; planned_end: string; billing_amount_paise: number } | null
}

/* ---------------- milestones ---------------- */
export type MilestoneDelivery = 'achieved_on_time' | 'achieved_late' | 'on_track' | 'at_risk' | 'overdue' | 'not_started'

export interface EstimateHint {
  ratio: number | null // typical effort ratio used
  basis: 'person_complexity' | 'person' | 'complexity' | 'team' | 'none'
  samples: number
  buffer_pct: number // suggested buffer (0 when estimates are sound)
  suggested_hours: number | null
  message: string | null
}
