// JSON shapes of the API (backend/app/routes/finance.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'

export interface InvoicesResult {
  items: InvoiceRow[]
  summary: {
    fy_label: string
    billed_fy: number
    collected_fy: number
    outstanding: number
    outstanding_count: number
    overdue: number
    overdue_count: number
    dso: number | null
    ageing: Record<AgeBucket, { amount: number; count: number }>
  }
}

export interface InvoiceRow {
  id: string
  version: number
  number: string
  project_id: string
  project_name: string
  project_code: string
  client: string
  milestone_id: string
  milestone_label: string
  invoiced_on: string
  due_on: string
  amount_paise: number
  paid_paise: number
  outstanding_paise: number
  paid_on: string | null
  age_days: number
  bucket: AgeBucket | null
  state: InvoiceState
  days_overdue: number
  stream: E.RevenueStream
  payments: { id: string; amount_paise: number; paid_on: string; reference: string }[]
}

export type AgeBucket = '0_30' | '31_60' | '61_90' | '90_plus'

export type InvoiceState = 'paid' | 'partly_paid' | 'due' | 'overdue'

export interface LedgerEntriesResult {
  scope: 'fy' | 'all'
  fy_label: string
  from: string
  to: string
  items: LedgerEntryRow[]
  automatic: { key: 'milestone' | 'spend' | 'payroll'; label: string; count: number; amount: number }[]
  can_edit: boolean
}

/** G13.02 — ledger entries as entered (one line per entry; recurring ones once, not per month). */
export interface LedgerEntryRow {
  id: string
  version: number
  kind: E.LedgerKind
  category: string
  description: string
  amount_paise: number
  date: string
  recurring: boolean
  until_on: string | null
  /** one-time: received / paid / expected; recurring: running / upcoming / ended */
  status: E.LedgerEntry['status']
  run_state: 'running' | 'upcoming' | 'ended' | null
  stream: E.RevenueStream | null
  project_id: string | null
  project_code: string | null
  /** money this entry has put in the books in the chosen scope (recurring = months × amount) */
  booked_paise: number
  months: number
}

export interface LedgerResult {
  from: string
  to: string
  items: LedgerRow[]
  totals: { income: number; expense: number; net: number; received: number; paid: number; expected_in: number; expected_out: number; count: number }
  categories: { income: string[]; expense: string[] }
  can_edit: boolean
}

/* ------------------------------------------------------------------ */
/* Contracts shared with src/api/finance.ts                            */
/* ------------------------------------------------------------------ */
export interface LedgerRow {
  key: string // id + occurrence (recurring rows repeat)
  id: string
  version: number
  kind: E.LedgerKind
  category: string
  description: string
  amount_paise: number
  date: string // occurrence date
  origin_date: string
  recurring: boolean
  until_on: string | null
  status: E.LedgerEntry['status']
  project_id: string | null
  project_name: string | null
  project_code: string | null
  invoice_id: string | null
  stream: E.RevenueStream | null
  locked: boolean
}

export interface PnlResult {
  from: string
  to: string
  prev_from: string
  prev_to: string
  /** last day counted: the period end, or today for a current period */
  as_of: string
  income: { by_stream: PnlLine[]; by_category: PnlLine[]; total: number; prev_total: number }
  expense: { by_category: PnlLine[]; direct: number; total: number; prev_total: number }
  gross_profit: number
  gross_margin: number | null
  net_profit: number
  net_margin: number | null
  prev_net_profit: number
  collected: number
  months: { month: string; label: string; billed: number; collected: number; cost: number; net: number; payroll: number; other_costs: number; net_pl: number }[]
  /** G13.01 — last 6 months ending this month (this month to date): payroll from payrollForMonth, other costs = non-salary ledger expenses */
  monthly: { month: string; label: string; billed: number; collected: number; payroll: number; other_costs: number; net: number; headcount: number; to_date: boolean }[]
  cash: { opening: number; balance: number; monthly_burn: number; recurring_income: number; net_burn: number; runway_months: number | null; cash_positive: boolean }
  revenue_ahead: { uninvoiced: number; uninvoiced_count: number; in_30: number; in_60: number; in_90: number; weighted_pipeline: number; open_pipeline: number; total: number }
}

export interface PnlLine {
  key: string
  label: string
  amount: number
  prev: number
}
