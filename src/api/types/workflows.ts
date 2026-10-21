// JSON shapes of the API (backend/app/engine/workflows.py). Types only — the backend is the source of truth.
import type { WorkflowProcess, ApprovalWorkflow, ApproverType } from '@/types/access'

export interface WfState {
  wf_process: WorkflowProcess
  wf_chain: StoredStep[]
  wf_step: number
  wf_step_at: string
}

/* ================================================================== */
/* Approval state on records                                            */
/* ================================================================== */
export interface StoredStep {
  step_id: string
  index: number // index in the workflow definition (-1 = fallback / legacy rule)
  name: string
  approver_id: string
  sla_days: number
  escalate_to_id: string | null
  decided_by?: string | null
  decided_at?: string | null
  escalated_from?: string | null
}

export interface RouteStep {
  name: string
  approver_id: string
  approver_name: string
  state: 'done' | 'current' | 'next' | 'skipped'
  decided_by_name: string | null
  escalated_from_name: string | null
}

export interface SimulationResult {
  steps: SimulatedStep[]
  skipped: { name: string; reason: string }[]
  fallback: boolean
  auto_approved: boolean
  summary: string
}

export interface SimulatedStep {
  index: number
  name: string
  approver_id: string
  approver_name: string
  approver_title: string
  sla_days: number
  escalate_to_name: string | null
  reason: string
}

/* ================================================================== */
/* Configuration API                                                    */
/* ================================================================== */
export interface WorkflowView extends ApprovalWorkflow {
  process_label: string
  summary: string
  step_summaries: string[]
  uses_amount: boolean
  uses_project: boolean
  is_default: boolean
  pending_change: { id: string; summary: string; maker_name: string; maker_id: string; created_at: string } | null
}

export interface WorkflowsResult {
  workflows: WorkflowView[]
  roles: { key: string; name: string; active: boolean; holders: number }[]
  approver_labels: Record<ApproverType, string>
  maker_checker: boolean
}
