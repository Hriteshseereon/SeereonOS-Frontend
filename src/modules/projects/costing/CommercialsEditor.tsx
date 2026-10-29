// v9 Commercials (decision D1): the cost lines by category — Office & hardware, Expenses, Miscellaneous, plus an
// optional Maintenance / support amount — then contingency and the profit margin (on actual cost, 50% by default) ⇄
// price. Used by the New Project wizard, the project's Costing tab and the cost calculator. Every subtotal and the
// whole chain come from the server preview; this component only edits the draft.
import type { ReactNode } from 'react'
import { Plus, X } from '@/ui/icons'
import type { CostGroup, CostingPreview } from '@/api/projects'
import { additionalCategoryLabel, COMMERCIAL_GROUPS, COST_GROUP_OF, type CommercialGroup } from '@/domain/costing'
import { fmtMoneyExact } from '@/domain/money'
import { cn } from '@/lib/utils'
import { Badge, Button, IconButton, Input, MoneyInput } from '@/ui'
import { newKey, type CostingDraft } from './costingDraft'

type PreviewLike = Pick<CostingPreview, 'totals' | 'markup_pct' | 'price_paise'> | undefined

export function groupAmount(groups: CostGroup[] | undefined, key: string): number | null | undefined {
  return groups?.find((g) => g.key === key)?.amount
}

export function CommercialsEditor({
  draft, onChange, preview, errors = {}, readOnly, compact,
}: {
  draft: CostingDraft
  onChange: (d: CostingDraft) => void
  preview: PreviewLike
  errors?: Record<string, string>
  readOnly?: boolean
  /** narrow containers: one column */
  compact?: boolean
}) {
  const groups = preview?.totals.groups
  const setLine = (key: string, patch: Partial<CostingDraft['additional'][number]>) => onChange({ ...draft, additional: draft.additional.map((x) => (x.key === key ? { ...x, ...patch } : x)) })
  const addLine = (g: CommercialGroup) => onChange({ ...draft, additional: [...draft.additional, { key: newKey('a'), category: g, description: '', amount_paise: 0 }] })
  const removeLine = (key: string) => onChange({ ...draft, additional: draft.additional.filter((x) => x.key !== key) })
  const idx = (key: string) => draft.additional.findIndex((x) => x.key === key)
  const markupShown = draft.price_mode === 'price' ? (preview?.markup_pct !== null && preview?.markup_pct !== undefined ? String(preview.markup_pct) : draft.markup_pct) : draft.markup_pct

  return (
    <div className="@container space-y-5">
      <div className={cn('grid gap-4', !compact && '@min-[760px]:grid-cols-3')}>
        {COMMERCIAL_GROUPS.map((g) => {
          const lines = draft.additional.filter((a) => (COST_GROUP_OF[a.category] ?? 'misc') === g.key)
          const sub = groupAmount(groups, g.key)
          return (
            <section key={g.key} aria-label={g.label} className="min-w-0 rounded-lg border border-line p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-[13.5px] font-semibold text-ink">{g.label}</h4>
                <span className="tnum whitespace-nowrap text-[13px] font-medium text-ink">{sub === undefined ? '—' : fmtMoneyExact(sub)}</span>
              </div>
              <p className="mb-2 text-[12px] text-ink-3">{g.hint}</p>
              <ul className="space-y-2">
                {lines.map((a, j) => {
                  const i = idx(a.key) // index in the payload (errors); j = position in this group (labels)
                  const e = errors[`additional_costs.${i}.description`] || errors[`additional_costs.${i}.amount_paise`]
                  return (
                    <li key={a.key} className="min-w-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_36px] gap-2">
                        <Input aria-label={`${g.label} line ${j + 1} description`} value={a.description} disabled={readOnly} invalid={!!errors[`additional_costs.${i}.description`]} placeholder={g.example} onChange={(ev) => setLine(a.key, { description: ev.target.value })} />
                        {!readOnly ? (
                          <IconButton label={`Remove ${a.description || 'line'}`} size="sm" onClick={() => removeLine(a.key)}>
                            <X className="size-4" />
                          </IconButton>
                        ) : <span />}
                        <MoneyInput aria-label={`${g.label} line ${j + 1} amount`} className="col-span-2" value={a.amount_paise} disabled={readOnly} invalid={!!errors[`additional_costs.${i}.amount_paise`]} onChange={(v) => setLine(a.key, { amount_paise: v })} />
                      </div>
                      {a.category !== g.key && <Badge size="sm" className="mt-1">{additionalCategoryLabel(a.category)}</Badge>}
                      {e && <p className="mt-1 text-[12.5px] font-medium text-danger-text">{e}</p>}
                    </li>
                  )
                })}
              </ul>
              {!readOnly && (
                <Button size="sm" variant="ghost" className="mt-1.5" icon={<Plus className="size-4" />} onClick={() => addLine(g.key)}>
                  Add line
                </Button>
              )}
            </section>
          )
        })}
      </div>

      <section className={cn('grid gap-4', !compact && '@min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-4')}>
        <Labeled label="Maintenance / support (₹)" hint="Optional. Support after go-live, AMC." error={errors['costing.maintenance_paise']}>
          <MoneyInput aria-label="Maintenance / support" value={draft.maintenance_paise} disabled={readOnly} onChange={(v) => onChange({ ...draft, maintenance_paise: v })} />
        </Labeled>
        <Labeled label="Contingency (% of total cost)" hint="Optional buffer; 0 by default." error={errors['costing.contingency_pct']}>
          <Input aria-label="Contingency percent" type="number" inputMode="decimal" min={0} max={100} step={1} suffix="%" value={draft.contingency_pct} disabled={readOnly} onChange={(e) => onChange({ ...draft, contingency_pct: e.target.value })} />
        </Labeled>
        <Labeled label="Profit margin (% of actual cost)" hint={draft.price_mode === 'price' ? 'Worked out from the price you typed.' : 'Price = actual cost × (1 + margin). 50% by default.'} error={errors['costing.markup_pct']}>
          <Input aria-label="Profit margin percent" type="number" inputMode="decimal" step={1} suffix="%" disabled={readOnly} value={markupShown} onChange={(e) => onChange({ ...draft, markup_pct: e.target.value, price_mode: 'markup' })} />
        </Labeled>
        <Labeled label="Price (₹)" hint={draft.price_mode === 'markup' ? 'Worked out from the margin. Type a price to set it.' : 'The margin follows this price.'} error={errors['costing.price_paise']}>
          <MoneyInput aria-label="Price" disabled={readOnly} value={draft.price_mode === 'markup' ? preview?.price_paise ?? null : draft.price_paise} onChange={(v) => onChange({ ...draft, price_paise: v, price_mode: 'price' })} />
        </Labeled>
      </section>
    </div>
  )
}

function Labeled({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <p className="text-[12.5px] font-medium text-danger-text">{error}</p> : hint ? <p className="text-[12.5px] text-ink-3">{hint}</p> : null}
    </div>
  )
}
