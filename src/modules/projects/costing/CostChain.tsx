// The planned-price chain, shown the same way everywhere a planned price appears (project costing, New Project wizard,
// cost calculator):  Total cost → + Contingency (x%) → Actual cost → + Profit margin (y% of actual cost) → Price.
// v9 (D1): the total cost lists its Commercials categories, and both readings of the margin are shown side by side —
// margin on cost (the % typed, 50% by default) and margin on price (profit ÷ price, 33.3% at 50%).
// Every amount is the server's (backend costing engine); this component only lays them out.
import { ArrowRight } from '@/ui/icons'
import type { CostGroup } from '@/api/projects'
import { fmtMoneyExact, fmtPct } from '@/domain/money'
import { cn } from '@/lib/utils'

export interface ChainTotals {
  resources?: number | null
  additional?: number | null
  maintenance?: number | null
  /** resources + additional costs + maintenance */
  total_cost: number | null
  contingency: number | null
  /** total cost + contingency */
  actual_cost?: number | null
  /** actual cost × (1 + markup) */
  price: number | null
  /** price − actual cost */
  profit: number | null
  /** profit ÷ price */
  margin: number | null
  /** profit ÷ actual cost (ratio) */
  markup: number | null
  /** v9: total cost by Commercials category */
  groups?: CostGroup[]
}

const pctLabel = (pct: number | null | undefined) => (pct === null || pct === undefined || !Number.isFinite(pct) ? '—' : `${Number(pct.toFixed(2))}%`)

export function CostChain({
  t,
  contingencyPct,
  markupPct,
  belowFloor,
  className,
  compact,
}: {
  t: ChainTotals
  /** contingency % as entered (e.g. 10) */
  contingencyPct: number | null | undefined
  /** markup % as stored / derived by the server (e.g. 25); falls back to the markup ratio */
  markupPct?: number | null
  belowFloor?: boolean
  className?: string
  /** narrow containers (dialogs, side panels): always stacked */
  compact?: boolean
}) {
  const mPct = markupPct ?? (t.markup !== null && t.markup !== undefined ? t.markup * 100 : null)
  const other = t.additional !== undefined && t.maintenance !== undefined && t.additional !== null && t.maintenance !== null ? (t.additional ?? 0) + (t.maintenance ?? 0) : null
  const groupLine = t.groups?.filter((g) => g.amount !== null && (g.amount > 0 || g.key === 'resources')).map((g) => `${g.label} ${fmtMoneyExact(g.amount)}`).join(' · ')
  const steps: { key: string; op: '' | '+' | '='; label: string; value: string; sub?: string; strong?: boolean }[] = [
    { key: 'total', op: '', label: 'Total cost', value: fmtMoneyExact(t.total_cost), sub: groupLine || (t.resources !== undefined && t.resources !== null && other !== null ? `${fmtMoneyExact(t.resources)} people · ${fmtMoneyExact(other)} other` : 'Resources, office & hardware, expenses, miscellaneous') },
    { key: 'cont', op: '+', label: `Contingency (${pctLabel(contingencyPct)})`, value: fmtMoneyExact(t.contingency), sub: 'of total cost' },
    { key: 'actual', op: '=', label: 'Actual cost', value: fmtMoneyExact(t.actual_cost), sub: 'total cost + contingency', strong: true },
    { key: 'markup', op: '+', label: `Profit margin (${pctLabel(mPct)})`, value: fmtMoneyExact(t.profit), sub: 'of actual cost' },
    { key: 'price', op: '=', label: 'Price', value: fmtMoneyExact(t.price), sub: 'actual cost + profit', strong: true },
  ]
  return (
    <div className={cn('@container', className)}>
      <ol
        aria-label="How the project price is built"
        className={cn('grid gap-0 overflow-hidden rounded-lg border border-line bg-surface', !compact && '@min-[880px]:grid-cols-[repeat(5,minmax(0,1fr))]')}
      >
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              'relative flex min-w-0 items-baseline justify-between gap-3 px-3.5 py-2.5',
              i > 0 && 'border-t border-line',
              !compact && '@min-[880px]:flex-col @min-[880px]:items-start @min-[880px]:justify-start @min-[880px]:gap-0.5 @min-[880px]:py-3',
              !compact && i > 0 && '@min-[880px]:border-l @min-[880px]:border-t-0',
              s.strong && 'bg-surface-2',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] leading-tight text-ink-3">
                {s.op && <span className="tnum w-3 shrink-0 text-center font-semibold text-ink-2" aria-hidden>{s.op}</span>}
                <span className={cn('min-w-0', s.strong && 'font-medium text-ink-2')}>{s.label}</span>
              </div>
              {s.sub && <div className={cn('mt-0.5 text-[11.5px] leading-snug text-ink-3', s.op && 'pl-[18px]')}>{s.sub}</div>}
            </div>
            <div className={cn('tnum shrink-0 whitespace-nowrap text-right leading-tight', s.strong ? 'text-[16px] font-semibold text-ink' : 'text-[14px] font-medium text-ink', !compact && '@min-[880px]:mt-1 @min-[880px]:text-left', !compact && s.op && '@min-[880px]:pl-[18px]')}>{s.value}</div>
            {!compact && i < steps.length - 1 && (
              <ArrowRight aria-hidden className="absolute -right-[7px] top-1/2 z-[1] hidden size-3.5 -translate-y-1/2 rounded-full bg-surface text-ink-3 @min-[880px]:block" />
            )}
          </li>
        ))}
      </ol>
      {/* narrow containers (phones): one stat per row — amounts to the paisa (₹7,33,641.71) don't fit three across */}
      <dl className="mt-3 grid grid-cols-1 gap-2.5 @min-[420px]:grid-cols-3 @min-[420px]:gap-3">
        <Stat label="Profit" value={fmtMoneyExact(t.profit)} sub="price − actual cost" tone={(t.profit ?? 0) < 0 ? 'danger' : undefined} />
        <Stat label="Margin on cost" value={fmtPct(t.markup)} sub="profit ÷ actual cost" />
        <Stat label="Margin on price" value={fmtPct(t.margin)} sub="profit ÷ price" tone={belowFloor ? 'danger' : t.margin !== null ? 'success' : undefined} />
      </dl>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] leading-tight text-ink-3">{label}</dt>
      <dd className={cn('tnum mt-1 whitespace-nowrap text-[15px] font-semibold leading-tight', tone === 'danger' ? 'text-danger-text' : tone === 'success' ? 'text-success-text' : 'text-ink')}>{value}</dd>
      <dd className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{sub}</dd>
    </div>
  )
}
