// JSON shapes of the API (backend/app/routes/spend.py). Types only — the backend is the source of truth.
import type * as B from '@/types/business'
import type { ExpenseCategory } from '@/modules/spend/labels'
import type * as E from '@/types/entities'
import type { PendingBrief } from './makerChecker'
import type { WfState, RouteStep } from './workflows'

export type { PendingBrief, WfState, RouteStep }

export interface LeakageRow extends LeakX {
  kind_label: string
  project_code: string | null
  project_name: string | null
  recorded_by_name: string
  open_paise: number
  source: string | null // e.g. "Deal · Jewellery catalogue app"
}

export type LeakX = B.RevenueLeakage & { client_id?: string | null }

export interface BudgetStatement {
  fy_start_year: number
  fy_label: string
  months: string[]
  current_month_index: number // −1 when the FY is in the future, 12 when it is over
  expense: BudgetLine[]
  revenue: BudgetLine[]
  totals: {
    expense_budget: number; expense_ytd_budget: number; expense_ytd_actual: number; expense_committed: number
    revenue_budget: number; revenue_ytd_budget: number; revenue_ytd_actual: number
    unbudgeted: number; over_lines: number
  }
  monthly: { month: string; budget: number; actual: number }[]
  unbudgeted: UnbudgetedItem[]
  has_budgets: boolean
  prev_fy_has_budgets: boolean
}

export interface BudgetLine {
  id: string | null
  version: number | null
  kind: 'expense' | 'revenue'
  category: string
  label: string
  owner_id: string | null
  notes: string
  monthly_budget: number[]
  monthly_actual: number[]
  monthly_committed: number[]
  budget_total: number
  ytd_budget: number
  ytd_actual: number // actual + committed through the current month
  ytd_variance: number // budget − actual (expense: negative = over); revenue: actual − budget
  ytd_variance_pct: number | null
  fy_actual: number
  over: boolean
  has_budget: boolean
  pending_change?: PendingBrief | null
}

export interface UnbudgetedItem {
  key: string
  source: 'ledger' | 'expense' | 'bill' | 'po'
  ref_id: string
  date: string
  category: string
  description: string
  amount: number
  excess: number
  reason: 'no_budget' | 'over_budget'
  state: 'actual' | 'committed' | 'commitment'
  approved_by: string | null
  approved_by_name: string
  justification: string | null
  counted: boolean
}

export interface ExpenseDetail extends ExpenseRow {
  receipt: { id: string; name: string; mime: string; data_url: string | null } | null
  history: { at: string; actor: string; action: string; summary: string }[]
}

/* ------------------------------------------------------------------ */
/* Contracts shared with src/api/spend.ts                              */
/* ------------------------------------------------------------------ */
export interface ExpenseRow extends ExpenseX {
  user_name: string
  approver_name: string
  decided_by_name: string
  first_approved_by_name: string | null
  project_code: string | null
  project_name: string | null
  client: string | null
  ledger_category: string
  receipt_name: string | null
  duplicate: boolean
  step: 'manager' | 'admin' | null
  /** "Step 2 of 2 · CEO approval" on multi-step chains */
  step_label: string | null
  route: RouteStep[] | null
  due_on: string | null
  escalates_to: string | null
  can_edit: boolean
  can_approve: boolean
  can_pay: boolean
}

/* ------------------------------------------------------------------ */
/* Stored extensions (optional fields kept on the rows)                */
/* ------------------------------------------------------------------ */
// Approval-workflow state (wf_*) is stored on claims, POs and bills — see the approval-workflow engine in backend/.
export type ExpenseX = B.ExpenseClaim & Partial<WfState> & { first_approved_by?: string | null; submitted_at?: string | null }

export interface ExpenseList {
  tab: ExpenseTab
  items: ExpenseRow[]
  counts: Record<ExpenseTab, number | null>
  totals: { claimed: number; pending: number; approved_unpaid: number; paid: number; rejected: number; out_of_budget: number }
  can: { approve: boolean; pay: boolean; all: boolean }
}

export type ExpenseTab = 'mine' | 'approve' | 'pay' | 'all'

export interface LeakageResult {
  fy_start_year: number
  fy_label: string
  items: LeakageRow[]
  summary: {
    total: number
    recovered: number
    net: number
    recoverable_open: number
    billed: number
    pct_of_billed: number | null
    by_kind: { kind: B.LeakageKind; label: string; amount: number; count: number }[]
    by_month: { month: string; amount: number }[]
    top_clients: { client: string; amount: number; count: number }[]
  }
}

export interface PurchasesResult {
  vendors: VendorRow[]
  pos: PORow[]
  bills: BillRow[]
  ageing: AgeingBucket[]
  /** Viewer holds spend authority (approves POs and bills). */
  can_approve: boolean
  /** New vendors and tax / bank changes need a second person (maker-checker on for vendors). */
  vendor_checked: boolean
  totals: { open_po_value: number; pending_po: number; payable: number; overdue: number; paid_fy: number; disputed: number }
}

export interface VendorRow extends Omit<VendorX, 'bank_account'> {
  bank_account_masked: string
  /** Full number only for people who manage procurement. */
  bank_account?: string
  pending_change: PendingBrief | null
  open_pos: number
  billed_fy: number
  payable: number
  overdue: number
}

/** Vendor bank details are stored with the vendor (v4); bank and tax fields are maker-checked. */
export type VendorX = B.Vendor & { bank_name?: string; bank_account?: string; ifsc?: string }

export interface PORow extends POX {
  vendor_name: string
  vendor_status: 'active' | 'blocked'
  project_code: string | null
  project_name: string | null
  requested_by_name: string
  decided_by_name: string
  total_paise: number
  gst_amount_paise: number
  billed_paise: number
  balance_paise: number
  bills: number
  approver_name: string
  step_label: string | null
  route: RouteStep[] | null
  /** Viewer may approve / reject this PO (current approver or spend authority, pending). */
  can_approve: boolean
}

export type POX = B.PurchaseOrder & Partial<WfState> & { title?: string; over_budget?: boolean; justification?: string | null; budget_remaining_paise?: number | null }

export interface BillRow extends BillX {
  vendor_name: string
  po_number: string | null
  po_amount_paise: number | null
  over_po_pct: number | null
  total_paise: number // amount + GST
  net_payable_paise: number // amount + GST − TDS
  days_overdue: number
  approved_by_name: string
  file_name: string | null
  approver_name: string
  step_label: string | null
  /** Viewer may approve this bill for payment (current approver or spend authority, received). */
  can_approve: boolean
}

export type BillX = B.VendorBill & Partial<WfState> & { approved_by?: string | null; approver_id?: string | null; dispute_reason?: string | null; category?: string | null; description?: string }

export interface AgeingBucket {
  key: 'not_due' | '0_30' | '31_60' | '61_90' | '90_plus'
  label: string
  amount: number
  count: number
}

export interface SpendMeta {
  expense_categories: { value: ExpenseCategory; label: string; ledger: string }[]
  budget_categories: string[]
  revenue_streams: { value: E.RevenueStream; label: string }[]
  projects: { id: string; code: string; name: string; client: string; billing_model: E.BillingModel }[]
  vendors: { id: string; name: string; status: 'active' | 'blocked'; payment_terms_days: number; category: string }[]
  today: string
  fy_start_year: number
  fy_start_month: number
}

export interface SpendSummary {
  month: string
  month_spend: number
  month_budget: number
  month_committed: number
  unbudgeted_fy: number
  pending_reimbursement: { amount: number; count: number }
  awaiting_approval: { amount: number; count: number }
  bills_payable: { amount: number; count: number; overdue: number }
  leakage_fy: number
  leakage_top: { kind: B.LeakageKind; label: string; amount: number }[]
  renewals: { id: string; client_id: string; client: string; title: string; kind: B.Contract['kind']; renewal_on: string; value_paise: number; days: number }[]
}
