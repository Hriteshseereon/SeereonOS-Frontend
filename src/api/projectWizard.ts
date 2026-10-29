// v9 — New Project wizard (items 1, 2; D1–D3), escalation matrix, customers picker and change requests sent to the
// team (item 7). Types mirror backend/app/routes/project_wizard.py, clients.py and projects.py. The server computes
// and validates everything; screens only shape input and format numbers.
import { http, requestFull } from './http'
import { useApi } from './query'
import type { BillingModel, ChangeRequest, Project, ProjectType, RevenueStream } from '@/types/entities'
import type { CostingAdditionalInput, CostingPreview, PlannedMilestone } from './projects'

/* ---------------- customers (D2) ---------------- */
export interface CustomerAddress {
  line: string
  city: string
  state: string
  state_code: string
  pincode: string
  same_as_billing?: boolean
}
export interface CustomerContact {
  name: string
  role: string
  email: string
  phone: string
  primary: boolean
}
export interface CustomerPaymentsProfile {
  bank_name: string
  account_name: string
  /** masked (•••• + last 4) unless the viewer holds finance.edit */
  account_no: string
  account_masked?: boolean
  ifsc: string
  upi: string
  payment_terms_days: number | null
  billing_email: string
}
/** The v9 customer fields on a client row (all optional). */
export interface CustomerExtras {
  registered_name?: string | null
  display_name?: string | null
  cin?: string | null
  registered_address?: CustomerAddress | null
  contacts?: CustomerContact[] | null
  payments_profile?: CustomerPaymentsProfile | null
}
export interface CustomerOption {
  id: string
  name: string
  display_name: string | null
  registered_name: string | null
  gstin: string
  pan: string
  cin: string
  industry: string
  country: string
  city: string
  state: string
  state_code: string
  pincode: string
  billing_address: string
  registered_address: CustomerAddress | null
  primary_contact: string
  email: string
  phone: string
  contacts: CustomerContact[]
  payment_terms_days: number | null
  has_payments_profile: boolean
  status: string
  projects: number
  active_projects: number
}
export interface CustomerOptions {
  items: CustomerOption[]
  can_create: boolean
  can_see_payments: boolean
}
/** Body of a new customer (POST /clients, or the wizard's step 1). */
export interface CustomerInput {
  name: string
  registered_name?: string
  display_name?: string
  industry?: string
  country?: string
  gstin?: string
  pan?: string
  cin?: string
  billing_address?: string
  city?: string
  state?: string
  state_code?: string
  pincode?: string
  registered_address?: Partial<CustomerAddress> | null
  contacts?: CustomerContact[]
  payments_profile?: Partial<CustomerPaymentsProfile> | null
  primary_contact?: string
  email?: string
  phone?: string
  payment_terms_days?: number
  owner_id?: string | null
  notes?: string
}
export interface CustomerProjectRow {
  id: string
  code: string
  name: string
  status: Project['status']
  type: ProjectType
  billing_model: BillingModel
  start_on: string
  end_on: string
  pm_id: string | null
  pm_name: string
  health: string
  progress: number
  contract_value_paise: number | null
  linked: boolean
}
export interface CustomerProjects {
  items: CustomerProjectRow[]
  totals: { projects: number; active: number; contract_value_paise: number | null }
  can_create_project: boolean
}

/* ---------------- project extras (V010) ---------------- */
export interface ProjectClientDetails {
  contact_name: string
  contact_role: string
  contact_email: string
  contact_phone: string
  po_reference: string
  notes: string
}
export type EscalationUnit = 'hours' | 'days' | 'working_days'
export interface EscalationRow {
  level: number
  user_id: string | null
  name: string
  role: string
  email: string
  phone: string
  after_value: number | null
  after_unit: EscalationUnit
  scope: string
}
export interface EscalationMatrix {
  rows: EscalationRow[]
  notes: string
  updated_at?: string
  updated_by?: string
}
export type ProjectV9 = Project & { client_id?: string | null; client_details?: ProjectClientDetails | null; escalation?: EscalationMatrix | null }
export interface EscalationView {
  project_id: string
  version: number
  matrix: EscalationMatrix
  updated_by_name: string | null
  can_edit: boolean
}

/* ---------------- wizard ---------------- */
export type WizardStep = 'customer' | 'details' | 'resources' | 'commercials' | 'milestones' | 'escalation'
export interface WizardTaskInput {
  title: string
  owner_id: string | null
  est_hours: number | null
  start_on: string | null
  due_on: string | null
  description: string
  subtasks?: WizardTaskInput[]
}
export interface WizardInput {
  request_key: string
  step?: WizardStep
  estimate_id?: string | null
  customer: { mode: 'existing' | 'new' | 'internal' | null; client_id?: string | null; new?: CustomerInput; internal_label?: string }
  details: {
    name: string
    pm_id: string | null
    start_on: string
    end_on: string
    type: ProjectType
    billing_model: BillingModel
    stream: RevenueStream
    priority: number
    contract_value_paise: number | null
    description: string
    client_details?: Partial<ProjectClientDetails> | null
    deal_id?: string | null
    documents?: { name: string; mime: string; size_bytes: number; data_url: string }[]
  }
  resources: { key: string; user_id: string | null; milestone_index: number | null; pct: number | null; from_on: string | null; to_on: string | null; role_label?: string | null }[]
  commercials: {
    additional_costs: CostingAdditionalInput[]
    maintenance_paise: number
    contingency_pct: number
    markup_pct: number | null
    price_paise: number | null
    price_mode: 'markup' | 'price'
  }
  milestones: { items: { name: string; billing_amount_paise: number; planned_end: string | null; details: string; tasks: WizardTaskInput[] }[] }
  escalation: { rows: Partial<EscalationRow>[]; notes: string }
}
export interface StepState {
  ok: boolean | null
  error: { code: string; message: string; field: string | null; status: number } | null
}
export interface WizardPreview {
  steps: Record<WizardStep, StepState>
  can_plan_cost: boolean
  can_see_rates: boolean
  can_create_customer: boolean
  costing: CostingPreview | null
  milestones: PlannedMilestone[]
  task_count?: number
  billing_total?: number
  contract_value_paise?: number
  customer: { mode: string; name: string; client_id: string | null } | null
  next_code: string
}
export interface WizardResult {
  project: ProjectV9
  duplicate: boolean
  tasks: number
}

export const wizardApi = {
  preview: (b: WizardInput) => http.post<WizardPreview>('/projects/wizard/preview', b),
  create: (b: WizardInput) => requestFull<WizardResult>('POST', '/projects/wizard', { body: b }),
  escalation: (projectId: string) => http.get<EscalationView>(`/projects/${projectId}/escalation`),
  saveEscalation: (projectId: string, b: { rows: Partial<EscalationRow>[]; notes: string }, version?: number) =>
    requestFull<EscalationView>('PUT', `/projects/${projectId}/escalation`, { body: b, ifMatch: version }),
  customers: () => http.get<CustomerOptions>('/customers/options'),
  customerProjects: (clientId: string) => http.get<CustomerProjects>(`/clients/${clientId}/projects`),
}

export function useCustomerOptions(enabled = true) {
  return useApi(['customers', 'options'], wizardApi.customers, { staleTime: 30_000, enabled })
}
export function useEscalation(projectId: string) {
  return useApi(['project', projectId, 'escalation'], () => wizardApi.escalation(projectId))
}

/* ---------------- change requests sent to the team (item 7) ---------------- */
export interface CrRecipient {
  user_id: string
  sent_at: string
  sent_by: string
  seen_at: string | null
}
export type ChangeRequestV9 = Omit<ChangeRequest, 'value_paise'> & { value_paise: number | null; sent_to?: CrRecipient[] | null; sent_at?: string | null; sent_by?: string | null; send_note?: string | null }
export interface SentToMeItem extends ChangeRequestV9 {
  project_code: string
  project_name: string
  can_open_project: boolean
  my_sent_at: string
  my_seen_at: string | null
  sent_by_name: string
}
export const crSendApi = {
  send: (id: string, b: { user_ids: string[]; note: string }) => requestFull<ChangeRequestV9>('POST', `/change-requests/${id}/send`, { body: b }),
  seen: (id: string) => requestFull<ChangeRequestV9>('POST', `/change-requests/${id}/seen`, { body: {} }),
  sentToMe: () => http.get<{ items: SentToMeItem[]; unseen: number }>('/change-requests/sent-to-me'),
}
export function useSentToMe() {
  return useApi(['change-requests', 'sent-to-me'], crSendApi.sentToMe)
}
