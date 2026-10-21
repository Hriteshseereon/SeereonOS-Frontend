// JSON shapes of the API (backend/app/routes/estimates.py). Types only — the backend is the source of truth.
import type { CostingAdditionalInput, CostingPreview, CostingRowView } from '@/api/projects'
import type { CostEstimate } from '@/types/v7'
import type * as E from '@/types/entities'

export interface EstimateCalcInput {
  start_on: string
  end_on: string
  milestones: { name: string; billing_amount_paise: number }[]
  resources: EstimateResourceInput[]
  additional_costs: CostingAdditionalInput[]
  maintenance_paise: number
  contingency_pct: number
  markup_pct: number | null
  price_paise: number | null
  price_mode: 'markup' | 'price'
}

export interface EstimateResourceInput {
  key: string
  user_id: string | null
  role_label: string | null
  monthly_ctc_paise: number | null
  milestone_index: number | null
  pct: number | null
  from_on: string | null
  to_on: string | null
}

export interface EstimateCompareItem extends EstimateListItem {
  resources_cost: number | null
  additional: number
  maintenance: number
  contingency: number | null
  contingency_pct: number
  billing_total: number
  milestones: number
}

export interface EstimateListItem {
  id: string
  number: string
  name: string
  client: string
  status: EstimateStatus
  deal: { id: string; title: string; stage: E.DealStage } | null
  project: { id: string; code: string; name: string } | null
  start_on: string
  end_on: string
  owner_id: string
  updated_at: string
  created_at: string
  version: number
  type: string
  billing_model: string
  scenario_of: string | null
  scenario_label: string | null
  price: number
  /** resources + additional + maintenance (before contingency) */
  total_cost: number | null
  /** total_cost + contingency */
  actual_cost?: number | null
  profit: number | null
  margin: number | null
  markup: number | null
  man_days: number
  working_days: number
  people: number
  role_rows: number
  below_floor: boolean
  costing_hidden: boolean
}

/* ------------------------------------------------------------------ */
/* Contracts shared with src/api/estimates.ts                          */
/* ------------------------------------------------------------------ */
export type EstimateStatus = CostEstimate['status']

export interface EstimateDetail {
  estimate: CostEstimate
  preview: EstimatePreview
  deal: { id: string; title: string; client: string; stage: E.DealStage; value_paise: number; project_id: string | null } | null
  project: { id: string; code: string; name: string; status: E.ProjectStatus } | null
  scenarios: EstimateListItem[]
  can_edit: boolean
  can_convert: boolean
  can_plan_cost: boolean
  costing_hidden: boolean
}

export interface EstimatePreview extends Omit<CostingPreview, 'rows'> {
  rows: EstimateRowView[]
  by_milestone: EstimateMilestoneCash[]
  billing_total: number
  /** price − milestone billing (billed on completion in the quote when positive) */
  unscheduled_billing: number
  role_rows: number
  named_rows: number
  /** true when cost-derived figures were removed: named people's salaries and the viewer lacks cost_rates.view */
  costing_hidden: boolean
}

export interface EstimateRowView extends CostingRowView {
  kind: 'person' | 'role'
  role_label: string | null
  /** assumed CTC of a role placeholder (typed by the estimator); always null for named people */
  monthly_ctc_paise: number | null
}

export interface EstimateMilestoneCash {
  index: number
  code: string
  name: string
  start: string
  end: string
  billing: number
  // cost-derived figures are null when the costing is hidden (named people, viewer without salary access)
  people_cost: number | null
  other_cost: number | null // additional (M1) + maintenance (last) + contingency share
  total_cost: number | null
  man_days: number
  net: number | null // billing − cost
  cumulative_billing: number
  cumulative_cost: number | null
  cumulative_net: number | null
}

export interface EstimateInput extends EstimateCalcInput {
  name: string
  client: string
  client_id: string | null
  deal_id: string | null
  type: string
  billing_model: string
  stream: string | null
  description: string
  notes: string
  /** optional note for the revision history */
  revision_note?: string
}

export interface EstimateList {
  items: EstimateListItem[]
  counts: Record<EstimateStatus | 'all', number>
  kpis: { in_progress: number; in_progress_value: number; quoted_value: number; quoted_count: number; avg_margin: number | null; margin_basis: number; won_converted: number; won_value: number; floor_pct: number; hidden: number }
}

export interface EstimateOptions {
  deals: { id: string; title: string; client: string; stage: E.DealStage; value_paise: number; product: string; expected_close: string }[]
  clients: { id: string; name: string }[]
  can_see_rates: boolean
  can_convert: boolean
  can_plan_cost: boolean
  floor_pct: number
  min_hours: number
}
