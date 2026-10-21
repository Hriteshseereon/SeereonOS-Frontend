// JSON shapes of the API (backend/app/routes/invoices.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'
import type { InvoiceParty, InvoiceLine } from '@/types/v7'

export interface BillableHours {
  from: string
  to: string
  people: { user_id: string; name: string; approved_hours: number; billed_hours: number; unbilled_hours: number; pending_hours: number; rate_paise: number }[]
  total_unbilled: number
}

export interface InvoiceDetail {
  invoice: E.Invoice
  status: InvoiceDisplayStatus
  totals: InvoiceTotals
  place_of_supply_label: string
  project: { id: string; code: string; name: string; client: string; billing_model: E.BillingModel; stream: E.RevenueStream }
  milestones: { id: string; no: number; name: string; billing_amount_paise: number; billing_status: E.MilestoneBilling }[]
  payments: { id: string; paid_on: string; reference: string; mode: string; gross_paise: number; tds_paise: number; revenue_paise: number }[]
  settled_paise: number
  received_paise: number
  tds_paise: number
  balance_paise: number
  days_overdue: number
  suggested_tds_paise: number
  ledger: { id: string; date: string; category: string; amount_paise: number; status: string }[]
  activity: { at: string; actor: string; summary: string }[]
  emails: { to: string; at: string; by: string }[]
  client_email: string
  can_edit: boolean
  can_pay: boolean
  can_cancel: boolean
  cancel_block: string | null
  next_number: string | null // the number a draft will get when issued
}

/* ------------------------------------------------------------------ */
/* Status and legacy upgrade                                           */
/* ------------------------------------------------------------------ */
export type InvoiceDisplayStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'

export interface InvoiceTotals {
  tax_mode: TaxMode
  lines: LineCalc[]
  subtotal: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  before_round: number
  round_off: number
  total: number
  reverse_charge: boolean
  by_rate: { rate: number; taxable: number; cgst: number; sgst: number; igst: number }[]
  words: string
}

/* ------------------------------------------------------------------ */
/* Calculation                                                         */
/* ------------------------------------------------------------------ */
export type TaxMode = 'intra' | 'inter' | 'export'

export interface LineCalc { id: string; gross: number; discount: number; taxable: number; rate: number; cgst: number; sgst: number; igst: number; total: number }

/* ------------------------------------------------------------------ */
/* Draft body: normalise + validate                                    */
/* ------------------------------------------------------------------ */
export interface InvoiceInput {
  project_id: string
  milestone_ids: string[]
  client_id: string | null
  seller: InvoiceParty
  bill_to: InvoiceParty
  ship_to: InvoiceParty | null
  invoiced_on: string
  due_on: string
  place_of_supply: string
  po_reference: string
  po_date: string | null
  reverse_charge: boolean
  lines: InvoiceLine[]
  tds_pct: number
  bank: NonNullable<E.Invoice['bank']>
  notes: string
  terms: string
  signatory: { name: string; title: string }
  number?: string
}

export interface InvoiceListResult {
  items: InvoiceListRow[]
  summary: {
    fy_label: string
    billed_fy: number // taxable value of invoices issued this FY (= revenue)
    gst_fy: number // GST charged on them (liability)
    collected_fy: number // cash + TDS settled this FY (incl. GST)
    outstanding: number
    outstanding_count: number
    overdue: number
    overdue_count: number
    drafts: number
    dso: number | null
    ageing: Record<AgeBucket, { amount: number; count: number }>
  }
  can_edit: boolean
}

export interface InvoiceListRow {
  id: string
  version: number
  number: string
  status: InvoiceDisplayStatus
  project_id: string
  project_code: string
  project_name: string
  client: string
  client_id: string | null
  milestone_label: string
  invoiced_on: string
  due_on: string
  taxable_paise: number
  gst_paise: number
  total_paise: number
  paid_paise: number // received + TDS
  balance_paise: number
  days_overdue: number
  age_days: number
  bucket: AgeBucket | null
  tax_mode: TaxMode
  stream: E.RevenueStream
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */
export type AgeBucket = '0_30' | '31_60' | '61_90' | '90_plus'

export interface Issue {
  field: string
  message: string
}

export interface PrefillMilestone { id: string; no: number; name: string; billing_amount_paise: number; billing_status: E.MilestoneBilling; state: string; planned_end: string; invoice_number: string | null; draft_numbers: string[] }
