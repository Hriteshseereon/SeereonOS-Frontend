// v9 wizard step 3: every allocated person, their share of the resource cost and the cost they add (server numbers).
import type { PersonShare } from '@/api/projects'
import { usePeopleMap } from '@/api/core'
import { fmtMoneyExact, fmtNum } from '@/domain/money'
import { cn } from '@/lib/utils'

export function PeopleShare({ people, resources, loading, className }: { people: PersonShare[]; resources: number | null | undefined; loading?: boolean; className?: string }) {
  const map = usePeopleMap()
  const seeShare = people.some((p) => p.share !== null)
  return (
    <section aria-label="Share of the resource cost" className={cn('@container rounded-lg border border-line', loading && 'opacity-70', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <h5 className="text-[13px] font-semibold">Who the resource cost is for</h5>
        {resources !== null && resources !== undefined && <span className="tnum whitespace-nowrap text-[12.5px] text-ink-3">Resource cost {fmtMoneyExact(resources)}</span>}
      </header>
      <ul className="divide-y divide-line">
        {people.map((p) => {
          const name = p.name ?? (p.user_id ? map.get(p.user_id)?.name : null) ?? p.role_label ?? '—'
          const pct = p.share === null ? null : p.share * 100
          return (
            <li key={p.key ?? p.user_id ?? name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 @min-[560px]:grid-cols-[minmax(0,1fr)_minmax(120px,200px)_auto]">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{name}</div>
                <div className="tnum text-[12px] text-ink-3">{fmtNum(p.man_days, 1)} man-days · {p.rows} row{p.rows === 1 ? '' : 's'}</div>
              </div>
              {seeShare && (
                <div className="col-span-2 flex items-center gap-2 @min-[560px]:col-span-1" aria-label={`${name}: ${pct === null ? '—' : pct.toFixed(1)}% of the resource cost`}>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right text-[12.5px] text-ink-2">{pct === null ? '—' : `${pct.toFixed(1)}%`}</span>
                </div>
              )}
              <div className="tnum col-start-2 row-start-1 whitespace-nowrap text-right text-[13px] font-medium text-ink @min-[560px]:col-start-auto @min-[560px]:row-start-auto">{p.cost === null ? <span className="font-normal text-ink-3">Needs salary access</span> : `+ ${fmtMoneyExact(p.cost)}`}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
