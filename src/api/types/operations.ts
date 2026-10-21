// JSON shapes of the API (backend/app/routes/operations.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'

export interface OpsSummary {
  kpis: { on_time_90: number | null; done_90: number; on_time_90_count: number; overdue_now: number; due_10: number; tracked: number }
  occurrences: OpsOccurrence[]
  people: { can: boolean; people: number; missing_last_week: number; pending_approval: number; on_leave_today: number; last_week: string }
  payroll: { can: boolean; month: string; label: string; status: 'not_started' | 'draft' | 'final'; run_id: string | null; last_label: string; last_status: 'not_started' | 'draft' | 'final'; last_run_id: string | null }
  invoicing: { can: boolean; outstanding: number; overdue_count: number; overdue_amount: number; achieved_not_invoiced: number; achieved_count: number; collected_month: number }
}

export interface OpsOccurrence { key: string; id: string; item: string; category: E.OpsItem['category']; recurring: E.Recurrence; owner_id: string; owner_name: string; due_on: string; period: string; days: number; status: 'overdue' | 'upcoming'; current: boolean; version: number }

export interface OpsResult {
  items: OpsRow[]
  counts: Record<OpsGroup, number>
  openings: { open: number; interviewing: number; offered: number; total_positions: number }
  can_edit: boolean
}

export interface OpsRow extends E.OpsItem {
  owner_name: string
  group: OpsGroup
  days: number // days until due (negative = overdue)
}

export type OpsGroup = 'overdue' | 'due' | 'upcoming' | 'done'
