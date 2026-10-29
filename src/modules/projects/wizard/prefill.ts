// Prefill the New Project wizard from a cost-calculator estimate ("Convert to project"). Role placeholders become
// resource rows without a person; the price carries over (price mode) so the project opens on the quoted price.
import type { EstimateDetail } from '@/api/estimates'
import type { CustomerOption } from '@/api/projectWizard'
import type { BillingModel, ProjectType, RevenueStream } from '@/types/entities'
import { newKey } from '../costing/costingDraft'
import { DEFAULT_STREAM, newMilestone, type WizardDraft } from './wizardDraft'

export function prefillFromEstimate(x: WizardDraft, d: EstimateDetail, customers: CustomerOption[], pmId: string | null): WizardDraft {
  const e = d.estimate
  const pv = d.preview
  const byName = customers.find((c) => c.name.trim().toLowerCase() === (e.client ?? '').trim().toLowerCase())
  const clientId = e.client_id ?? byName?.id ?? null
  const type = (e.type as ProjectType) || 'service'
  return {
    ...x,
    estimate_id: e.id,
    customer: clientId ? { ...x.customer, mode: 'existing', client_id: clientId } : { ...x.customer, mode: 'new', new: { ...x.customer.new, name: e.client } },
    details: {
      ...x.details,
      name: e.name.replace(/ — Scenario [A-Z]$/, ''),
      pm_id: x.details.pm_id ?? pmId,
      start_on: e.start_on,
      end_on: e.end_on,
      type,
      billing_model: (e.billing_model as BillingModel) || 'fixed',
      stream: ((e.stream as RevenueStream) || DEFAULT_STREAM[type]) ?? 'services',
      streamTouched: !!e.stream,
      description: e.description ?? '',
      deal_id: e.deal_id ?? null,
      contract_value_paise: null,
    },
    costing: {
      rows: pv.rows.map((r, i) => ({
        key: e.resources[i]?.id ?? newKey('r'),
        id: null,
        user_id: r.kind === 'person' ? r.user_id : null,
        ms: r.milestone_index !== null && r.milestone_index !== undefined && r.ms_code !== 'All' ? `i:${r.milestone_index}` : '',
        pct: r.pct === null ? '' : String(r.pct),
        from_on: e.resources[i]?.from_on ?? null,
        to_on: e.resources[i]?.to_on ?? null,
        role_label: r.kind === 'person' ? null : r.role_label ?? e.resources[i]?.role_label ?? null,
      })),
      additional: e.additional_costs.map((a) => ({ key: a.id || newKey('a'), category: a.category, description: a.description, amount_paise: a.amount_paise })),
      maintenance_paise: e.maintenance_paise,
      contingency_pct: String(e.contingency_pct ?? 0),
      markup_pct: String(e.markup_pct ?? 50),
      price_paise: pv.totals.price ?? e.price_paise,
      price_mode: 'price',
    },
    milestones: (pv.milestones.length ? pv.milestones : []).map((m) => ({ ...newMilestone(m.name), billing_amount_paise: m.billing_amount_paise })),
  }
}
