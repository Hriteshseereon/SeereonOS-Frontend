// JSON shapes of the API (backend/app/routes/workflows_v7.py). Types only — the backend is the source of truth.
import type * as V7 from '@/types/v7'

export interface WfAppraisalBrief {
  id: string
  title: string
  status: WfStatus
  stage_index: number
  stage_count: number
  stage_name: string | null
  assignee: WfPerson | null
  due_on: string | null
  overdue: boolean
  can_act: boolean
  stages: { name: string; status: WfStageView['status']; person: WfPerson | null; acted_at: string | null }[]
  outputs: { kind: string; label: string }[]
}

export type WfStatus = V7.WfInstance['status']

/* ================================================================== */
/* Shared shapes (also used by the client — src/api/wf.ts)             */
/* ================================================================== */
export interface WfPerson {
  id: string
  name: string
  title: string
  hue: number
  invited?: boolean
}

export interface WfStageView {
  key: string
  name: string
  index: number
  assignee_kind: string
  status: 'done' | 'current' | 'upcoming' | 'skipped'
  person: WfPerson | null
  acted_at: string | null
  due_on: string | null
  overdue: boolean
  sla_days: number
  fields: WfFieldView[]
  hidden_count: number
  instructions: string
  sees_compensation: boolean
}

export interface WfFieldView extends V7.WfField {
  value: unknown
  display: string
}

export interface WfDetail extends WfRow {
  description: string
  template_rev: number
  latest_rev: number
  stages: WfStageView[]
  form: { stage_key: string; stage_name: string; fields: V7.WfField[]; values: Record<string, unknown>; instructions: string; can_send_back: boolean; can_reject: boolean; sees_compensation: boolean } | null
  facts: WfFacts | null
  outputs: WfOutputView[]
  history: { stage_key: string; stage_name: string; by: WfPerson | null; action: V7.WfInstance['history'][number]['action']; note: string; at: string; to: WfPerson | null }[]
  comments: { id: string; by: WfPerson | null; at: string; body: string }[]
  context: { cycle_id: string | null; cycle_name: string | null; appraisal_id: string | null; note: string | null }
  perms: { can_act: boolean; acting_as: 'assignee' | 'pool' | 'delegate' | null; can_reassign: boolean; can_cancel: boolean; can_comment: boolean }
  escalated: boolean
}

export interface WfRow {
  id: string
  title: string
  template_id: string
  template_name: string
  process: V7.WfProcess
  subject: WfPerson | null
  initiator: WfPerson | null
  status: WfStatus
  stage_index: number
  stage_count: number
  stage_name: string | null
  assignee: WfPerson | null
  due_on: string | null
  overdue: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
  can_act: boolean
  version: number
}

export interface WfFacts {
  current_ctc_paise: number | null
  current_annual_paise: number | null
  current_from: string | null
  recommended_pct: number | null
  endorsed_pct: number | null
  normalised_pct: number | null
  approved_pct: number | null
  basis: string | null
  basis_pct: number | null
  new_ctc_paise: number | null
  new_annual_paise: number | null
  monthly_increase_paise: number | null
  annual_impact_paise: number | null
  effective_from: string | null
  band: { grade: string; min_paise: number | null; max_paise: number | null; status: 'within' | 'above' | 'below' } | null
  limited: boolean // the subject's reduced view (outcome only)
}

export interface WfOutputView {
  kind: string
  label: string
  ref_id: string
  status: string | null
  link: string | null
}

export interface WfIssue {
  path: string
  message: string
}

export interface WfListView {
  rows: WfRow[]
  counts: { waiting: number; started: number; about: number; all: number | null }
  can_start: boolean
  can_design: boolean
}

export interface WfMeta {
  roles: { key: string; name: string; holders: string[] }[]
  doc_templates: { key: string; name: string; active: boolean }[]
  email_templates: { key: string; name: string }[]
  departments_without_head: string[]
  joiners: { id: string; name: string; email: string; manager: string | null }[] // pending invites (onboarding subjects)
  cycles: { id: string; name: string; status: string }[] // open appraisal cycles to link
}

export interface WfTemplateRow {
  id: string
  key: string | null
  name: string
  process: V7.WfProcess
  description: string
  active: boolean
  self_service: boolean
  stage_names: string[]
  rev: number
  running: number
  completed: number
  updated_at: string
  version: number
}

/* ---------------- approvals inbox feed (used by routes/company.ts) ---------------- */
export interface WfInboxRow {
  id: string
  version: number
  title: string
  template_name: string
  process: V7.WfProcess
  stage_name: string
  step_label: string
  subject_id: string | null
  started_at: string | null
  due_on: string | null
  escalates_to: string | null
  via_delegation: boolean
  note: string | null
}
