// Client-side draft of a cost estimate. The server (POST /estimates/preview) computes every number; this module only
// shapes user input into the API payload and back. Milestones use the create form's "name | amount" parser.
import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/api/query'
import { estimatesApi, type EstimateCalcInput, type EstimateDetail, type EstimateInput } from '@/api/estimates'
import { parseMilestoneLines } from '@/domain/costing'
import { addMonths, todayISO } from '@/domain/calendar'
import { emptyDraft, newKey, type CostingDraft } from '@/modules/projects/costing/costingDraft'

export interface EstRow {
  key: string
  kind: 'person' | 'role'
  user_id: string | null
  role_label: string
  ctc_paise: number
  ms: string // milestone index as text ('' = not chosen)
  pct: string
  from_on: string | null // null = follow the milestone
  to_on: string | null
}
export interface EstMilestone {
  key: string
  name: string
  amount_paise: number
  pct: string
}
export interface EstDraft {
  name: string
  client: string
  client_id: string | null
  deal_id: string | null
  type: string
  billing_model: string
  stream: string | null
  start_on: string
  end_on: string
  description: string
  notes: string
  msText: string // quick-add box (paste "name | amount" lines)
  /** v9 milestone-wise price breakdown: each milestone bills an amount, or a % of the price */
  ms: EstMilestone[]
  split: 'amount' | 'pct'
  rows: EstRow[]
  costing: CostingDraft // additional costs, maintenance, contingency, markup ⇄ price (rows unused)
}


export function blankDraft(): EstDraft {
  const start = todayISO()
  return {
    name: '', client: '', client_id: null, deal_id: null, type: 'service', billing_model: 'fixed', stream: null,
    start_on: start, end_on: addMonths(start, 3), description: '', notes: '', msText: '', ms: [], split: 'pct', rows: [], costing: { ...emptyDraft(), markup_pct: '50' },
  }
}

export function draftFromDetail(d: EstimateDetail): EstDraft {
  const e = d.estimate
  const idx = new Map(e.milestones.map((m, i) => [m.key, i]))
  return {
    name: e.name, client: e.client, client_id: e.client_id ?? null, deal_id: e.deal_id, type: e.type, billing_model: e.billing_model, stream: e.stream ?? null,
    start_on: e.start_on, end_on: e.end_on, description: e.description ?? '', notes: e.notes,
    msText: '',
    ms: e.milestones.map((m) => ({ key: newKey('m'), name: m.name, amount_paise: m.billing_amount_paise, pct: m.billing_pct !== undefined && m.billing_pct !== null ? String(m.billing_pct) : '' })),
    split: e.milestones.length > 0 && e.milestones.every((m) => m.billing_pct !== undefined && m.billing_pct !== null) ? 'pct' : 'amount',
    rows: e.resources.map((r) => ({
      key: r.id, kind: r.user_id ? 'person' : 'role', user_id: r.user_id, role_label: r.role_label ?? '', ctc_paise: r.monthly_ctc_paise ?? 0,
      ms: r.milestone_key !== null && idx.has(r.milestone_key) ? String(idx.get(r.milestone_key)) : '', pct: String(r.pct), from_on: r.from_on, to_on: r.to_on,
    })),
    costing: {
      rows: [],
      additional: e.additional_costs.map((a) => ({ key: a.id || newKey('a'), category: a.category, description: a.description, amount_paise: a.amount_paise })),
      maintenance_paise: e.maintenance_paise,
      contingency_pct: String(e.contingency_pct ?? 0),
      markup_pct: String(e.markup_pct ?? 0),
      price_paise: e.price_paise,
      price_mode: 'price',
    },
  }
}

export function milestonesOf(d: EstDraft) {
  const parsed = parseMilestoneLines(d.msText)
  const list = d.ms
    .filter((m) => m.name.trim())
    .map((m) => (d.split === 'pct' ? { name: m.name.trim(), billing_amount_paise: 0, billing_pct: Number(m.pct) || 0 } : { name: m.name.trim(), billing_amount_paise: m.amount_paise }))
  return { parsed, list }
}

/** Quick add: the pasted "name | amount" lines become milestone rows. */
export function addPasted(d: EstDraft): EstDraft {
  const items = parseMilestoneLines(d.msText).items.filter((x) => !x.error)
  return { ...d, msText: '', ms: [...d.ms, ...items.map((x) => ({ key: newKey('m'), name: x.name, amount_paise: x.amount_paise, pct: '' }))], split: items.some((x) => x.amount_paise > 0) ? 'amount' : d.split }
}

const numOrNull = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))

export function calcInput(d: EstDraft): EstimateCalcInput {
  const c = d.costing
  return {
    start_on: d.start_on,
    end_on: d.end_on,
    milestones: milestonesOf(d).list,
    resources: d.rows.map((r) => ({
      key: r.key,
      user_id: r.kind === 'person' ? r.user_id : null,
      role_label: r.kind === 'role' ? r.role_label : null,
      monthly_ctc_paise: r.kind === 'role' ? r.ctc_paise : null,
      milestone_index: r.ms === '' ? null : Number(r.ms),
      pct: numOrNull(r.pct),
      from_on: r.from_on || null,
      to_on: r.to_on || null,
    })),
    additional_costs: c.additional.map((a) => ({ id: a.key, category: a.category, description: a.description, amount_paise: a.amount_paise })),
    maintenance_paise: c.maintenance_paise,
    contingency_pct: numOrNull(c.contingency_pct) ?? 0,
    markup_pct: numOrNull(c.markup_pct),
    price_paise: c.price_paise,
    price_mode: c.price_mode,
  }
}

export function saveInput(d: EstDraft, revisionNote?: string): EstimateInput {
  return {
    ...calcInput(d),
    name: d.name, client: d.client, client_id: d.client_id, deal_id: d.deal_id, type: d.type, billing_model: d.billing_model, stream: d.stream,
    description: d.description, notes: d.notes, revision_note: revisionNote,
  }
}

function useDebounced<T>(v: T, ms: number): T {
  const [x, setX] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return x
}

/** Server-truth preview of the estimate, debounced while the user types. */
export function useEstimatePreview(input: EstimateCalcInput | null, enabled = true) {
  const raw = useMemo(() => (input ? JSON.stringify(input) : ''), [input])
  const key = useDebounced(raw, 280)
  return useApi(['estimate-preview', key], () => estimatesApi.preview(JSON.parse(key) as EstimateCalcInput), { enabled: enabled && !!key, placeholderData: keepPreviousData, staleTime: 30_000, retry: false })
}
