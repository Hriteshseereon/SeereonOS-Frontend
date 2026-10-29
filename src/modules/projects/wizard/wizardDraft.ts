// New Project wizard — client-side draft. It only shapes what the person types into the API payload
// (POST /projects/wizard/preview and POST /projects/wizard); the server validates and computes every number.
import type { BillingModel, ProjectType, RevenueStream } from '@/types/entities'
import type { CustomerInput, EscalationRow, WizardInput, WizardStep } from '@/api/projectWizard'
import { addMonths, todayISO } from '@/domain/calendar'
import { emptyDraft, newKey, draftToInput, type CostingDraft } from '../costing/costingDraft'
import { emptyCustomer } from '@/modules/clients/CustomerForm'

export const STEPS: { key: WizardStep | 'overview'; label: string; short: string; hint: string }[] = [
  { key: 'customer', label: 'Customer', short: 'Customer', hint: 'Pick or add the customer' },
  { key: 'details', label: 'Project & client details', short: 'Details', hint: 'Name, PM, dates, type' },
  { key: 'resources', label: 'Resource allocation', short: 'Resources', hint: 'Who works on it, and how much' },
  { key: 'commercials', label: 'Commercials', short: 'Commercials', hint: 'Costs, margin and price' },
  { key: 'milestones', label: 'Milestones & WBS', short: 'Milestones', hint: 'Optional — or later' },
  { key: 'escalation', label: 'Escalation matrix', short: 'Escalation', hint: 'Who to call, and when' },
  { key: 'overview', label: 'Overview & create', short: 'Overview', hint: 'Check everything' },
]
export type StepKey = (typeof STEPS)[number]['key']

export interface TaskDraft {
  key: string
  title: string
  owner_id: string | null
  est_hours: string
  start_on: string
  due_on: string
  description: string
  subtasks: TaskDraft[]
  open?: boolean
}
export interface MsDraft {
  key: string
  name: string
  billing_amount_paise: number
  planned_end: string
  details: string
  tasks: TaskDraft[]
}
export interface EscDraftRow {
  key: string
  level: string
  who: 'person' | 'external'
  user_id: string | null
  name: string
  role: string
  email: string
  phone: string
  after_value: string
  after_unit: EscalationRow['after_unit']
  scope: string
}
export interface WizardDraft {
  request_key: string
  estimate_id: string | null
  customer: { mode: 'existing' | 'new' | 'internal' | null; client_id: string | null; new: CustomerInput; internal_label: string }
  details: {
    name: string
    pm_id: string | null
    start_on: string
    end_on: string
    type: ProjectType
    billing_model: BillingModel
    stream: RevenueStream
    streamTouched: boolean
    priority: number
    contract_value_paise: number | null // null = follow the price
    description: string
    deal_id: string | null
    client_details: { contact_name: string; contact_role: string; contact_email: string; contact_phone: string; po_reference: string; notes: string }
  }
  docs: File[]
  costing: CostingDraft
  milestones: MsDraft[]
  milestonesSkipped: boolean
  escalation: { rows: EscDraftRow[]; notes: string }
}

export const DEFAULT_STREAM: Record<ProjectType, RevenueStream> = { product: 'products', service: 'services', saas: 'saas', ams: 'ams' }

export const newTask = (): TaskDraft => ({ key: newKey('t'), title: '', owner_id: null, est_hours: '8', start_on: '', due_on: '', description: '', subtasks: [], open: true })
export const newMilestone = (name = ''): MsDraft => ({ key: newKey('m'), name, billing_amount_paise: 0, planned_end: '', details: '', tasks: [] })
export const newEscRow = (level: number): EscDraftRow => ({ key: newKey('e'), level: String(level), who: 'person', user_id: null, name: '', role: '', email: '', phone: '', after_value: '', after_unit: 'hours', scope: '' })

export function blankWizard(pmId: string | null): WizardDraft {
  const start = todayISO()
  return {
    request_key: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    estimate_id: null,
    customer: { mode: null, client_id: null, new: emptyCustomer(), internal_label: 'Internal' },
    details: {
      name: '', pm_id: pmId, start_on: start, end_on: addMonths(start, 3), type: 'service', billing_model: 'fixed', stream: 'services', streamTouched: false, priority: 3,
      contract_value_paise: null, description: '', deal_id: null,
      client_details: { contact_name: '', contact_role: '', contact_email: '', contact_phone: '', po_reference: '', notes: '' },
    },
    docs: [],
    costing: { ...emptyDraft(), markup_pct: '50' },
    milestones: [],
    milestonesSkipped: false,
    escalation: { rows: [], notes: '' },
  }
}

const numOrNull = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))

function taskInput(t: TaskDraft): WizardInput['milestones']['items'][number]['tasks'][number] {
  return {
    title: t.title,
    owner_id: t.owner_id,
    est_hours: numOrNull(t.est_hours),
    start_on: t.start_on || null,
    due_on: t.due_on || null,
    description: t.description,
    subtasks: t.subtasks.map(taskInput),
  }
}

/** The API payload (documents are attached separately at create time). */
export function toInput(d: WizardDraft, step?: WizardStep): WizardInput {
  const c = draftToInput(d.costing)
  const ms = d.milestonesSkipped ? [] : d.milestones
  return {
    request_key: d.request_key,
    step,
    estimate_id: d.estimate_id,
    customer: d.customer.mode === 'new' ? { mode: 'new', new: d.customer.new } : d.customer.mode === 'existing' ? { mode: 'existing', client_id: d.customer.client_id } : d.customer.mode === 'internal' ? { mode: 'internal', internal_label: d.customer.internal_label } : { mode: null },
    details: {
      name: d.details.name,
      pm_id: d.details.pm_id,
      start_on: d.details.start_on,
      end_on: d.details.end_on,
      type: d.details.type,
      billing_model: d.details.billing_model,
      stream: d.details.stream,
      priority: d.details.priority,
      contract_value_paise: d.details.contract_value_paise,
      description: d.details.description,
      deal_id: d.details.deal_id,
      client_details: d.details.client_details,
    },
    resources: c.resources.map((r) => ({
      key: r.key ?? newKey('r'),
      user_id: r.user_id,
      // a row on a milestone the person removed in step 5 falls back to All milestones
      milestone_index: r.milestone_index !== null && r.milestone_index !== undefined && r.milestone_index < ms.length ? r.milestone_index : null,
      pct: r.pct,
      from_on: r.from_on,
      to_on: r.to_on,
      ...(r.role_label ? { role_label: r.role_label } : {}),
    })),
    commercials: {
      additional_costs: c.additional_costs,
      maintenance_paise: c.maintenance_paise,
      contingency_pct: c.contingency_pct,
      markup_pct: c.markup_pct,
      price_paise: c.price_paise,
      price_mode: c.price_mode,
    },
    milestones: { items: ms.map((m) => ({ name: m.name, billing_amount_paise: m.billing_amount_paise, planned_end: m.planned_end || null, details: m.details, tasks: m.tasks.map(taskInput) })) },
    escalation: {
      rows: d.escalation.rows.map((r) => ({
        level: Number(r.level) || 1,
        user_id: r.who === 'person' ? r.user_id : null,
        name: r.who === 'external' ? r.name : '',
        role: r.role,
        email: r.email,
        phone: r.phone,
        after_value: numOrNull(r.after_value),
        after_unit: r.after_unit,
        scope: r.scope,
      })),
      notes: d.escalation.notes,
    },
  }
}

/** When a milestone is removed, resource rows that pointed at it (or after it) keep pointing at the right one. */
export function reindexRows(costing: CostingDraft, removedIndex: number): CostingDraft {
  return {
    ...costing,
    rows: costing.rows.map((r) => {
      if (!r.ms.startsWith('i:')) return r
      const i = Number(r.ms.slice(2))
      if (i === removedIndex) return { ...r, ms: '', from_on: null, to_on: null }
      if (i > removedIndex) return { ...r, ms: `i:${i - 1}` }
      return r
    }),
  }
}

/** Map an API error field (e.g. "customer.gstin", "milestones.items.0.tasks.1.title") to the wizard step it belongs to. */
export function stepOfField(field: string | null | undefined): WizardStep {
  const head = (field ?? '').split('.')[0]
  if (head === 'resources') return 'resources'
  if (head === 'additional_costs' || head === 'costing') return 'commercials'
  if (head === 'customer' || head === 'milestones' || head === 'escalation' || head === 'commercials') return head as WizardStep
  return 'details'
}

/** V9-FIX (item 10): an escalation row with nothing typed — the server skips it, so the overview hides it too. */
export function escRowEmpty(r: EscDraftRow): boolean {
  const who = r.who === 'person' ? r.user_id : r.name.trim()
  return !who && !r.role.trim() && !r.email.trim() && !r.phone.trim() && !r.scope.trim()
}

const ESC_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** V9-FIX (item 10): the server's escalation row rules (project_wizard.validate_escalation), client side — errors keyed
 *  `rows.<i>.<field>` like the server's `escalation.rows.<i>.<field>`. Active-person checks stay on the server. */
export function validateEscRows(rows: EscDraftRow[], notes = ''): Record<string, string> {
  const out: Record<string, string> = {}
  if (rows.length > 20) out['rows'] = 'Keep the escalation matrix to 20 rows.'
  rows.forEach((r, i) => {
    if (escRowEmpty(r)) return
    const n = i + 1
    const lvl = Number(r.level || n)
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 9) out[`rows.${i}.level`] = `Escalation row ${n}: the level is a whole number from 1 to 9.`
    else if (r.who === 'person' ? !r.user_id : !r.name.trim()) out[`rows.${i}.name`] = `Escalation row ${n}: choose a person or type the name.`
    else if (r.email.trim() && !ESC_EMAIL_RE.test(r.email.trim())) out[`rows.${i}.email`] = `Escalation row ${n}: enter a valid e-mail address.`
    else if (r.after_value.trim() !== '') {
      const a = Number(r.after_value)
      if (!Number.isFinite(a) || a < 0 || a > 999) out[`rows.${i}.after_value`] = `Escalation row ${n}: escalate after 0 to 999 hours or days.`
    }
  })
  if (notes.trim().length > 8000) out['notes'] = 'Keep the escalation notes under 8,000 characters.'
  return out
}
