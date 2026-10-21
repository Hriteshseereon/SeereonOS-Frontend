// JSON shapes of the API (backend/app/routes/clients.py). Types only — the backend is the source of truth.
import type * as B from '@/types/business'
import type * as E from '@/types/entities'
import type { LeakageRow } from './spend'

export type { LeakageRow }

export interface ClientDetail {
  client: ClientRow
  projects: { id: string; code: string; name: string; status: E.ProjectStatus; billing_model: E.BillingModel; contract_value_paise: number | null; health: string; pm_name: string; end_on: string }[]
  deals: { id: string; title: string; stage: E.DealStage; value_paise: number; owner_name: string; expected_close: string; lost_reason: string | null }[]
  invoices: { id: string; number: string; project_code: string; invoiced_on: string; due_on: string; amount_paise: number; paid_paise: number; outstanding_paise: number; days_overdue: number }[]
  other_income: { date: string; description: string; amount_paise: number; status: string }[]
  contracts: ContractRow[]
  leakage: LeakageRow[]
  rebill: { id: string; date: string; person: string; description: string; amount_paise: number; status: B.ExpenseStatus; project_code: string | null }[]
  rebill_total: number
  contacts: { name: string; role: string; email: string; phone: string; source: string }[]
  activity: { at: string; actor: string; summary: string }[]
}

export interface ClientRow extends ClientX {
  owner_name: string
  projects: number
  active_projects: number
  open_deals: number
  pipeline_value: number
  billed: number
  billed_fy: number
  collected: number
  outstanding: number
  overdue: number
  contracts: number
  contract_value: number
  next_renewal: string | null
  leakage_fy: number
  health_reasons: string[]
}

export type ClientX = B.Client & { notes?: string; status_manual?: boolean; city?: string; state?: string; state_code?: string; pincode?: string; pan?: string }

/* ------------------------------------------------------------------ */
/* Contracts shared with src/api/clients.ts                            */
/* ------------------------------------------------------------------ */
export interface ContractRow extends ContractX {
  client_name: string
  project_code: string | null
  days_to_renewal: number | null
  computed_status: B.Contract['status']
  file_name: string | null
}

export type ContractX = B.Contract & { reminded_on?: string | null; renewed_from?: string | null; file_name?: string | null }

export interface ClientsResult {
  items: ClientRow[]
  totals: { clients: number; active: number; at_risk: number; billed_fy: number; outstanding: number; overdue: number; renewals_60: number; renewal_value: number }
  renewals: ContractRow[]
  can_edit: boolean
}
