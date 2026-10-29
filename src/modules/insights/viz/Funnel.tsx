// Pipeline funnel: one horizontal bar per stage (length = deals that reached the stage), ordered steps of one hue
// (stages are ordinal), the count and value as labels outside the bar, and the stage-to-stage conversion between rows.
import type { FunnelViz } from '@/api/types/viz'
import { Tooltip } from '@/ui'
import { fmtMoneyCompact, fmtPct } from '@/domain/money'
import { ordinalColour } from './Cartesian'

export function Funnel({ viz }: { viz: FunnelViz }) {
  const max = Math.max(1, ...viz.stages.map((s) => s.reached))
  return (
    <ol className="space-y-1">
      {viz.stages.map((s, i) => (
        <li key={s.key}>
          {i > 0 && (
            <div className="flex items-center gap-2 py-0.5 pl-[min(28%,140px)] text-[11.5px] text-ink-3">
              <span aria-hidden>↓</span>
              {s.conversion === null ? '—' : `${fmtPct(s.conversion, 0)} of the previous stage`}
            </div>
          )}
          <div className="grid grid-cols-[minmax(84px,28%)_minmax(0,1fr)] items-center gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
            <span className="truncate text-[13px] font-medium text-ink">{s.label}</span>
            <Tooltip
              content={
                <span className="block">
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block font-normal opacity-80">
                    {s.reached} reached · {s.count} here now · {fmtMoneyCompact(s.value)}
                  </span>
                </span>
              }
            >
              <span tabIndex={0} className="viz-hit flex min-w-0 items-center gap-2" aria-label={`${s.label}: ${s.reached} deals reached, ${s.count} at this stage, value ${fmtMoneyCompact(s.value)}`}>
                <span className="h-5 shrink-0 rounded-r-[4px]" style={{ width: `${Math.max(1.5, (s.reached / max) * 72)}%`, background: ordinalColour(i, viz.stages.length) }} />
                <span className="min-w-0 truncate whitespace-nowrap text-[12.5px] text-ink-2">
                  <span className="tnum font-semibold text-ink">{s.reached}</span> reached · {s.count} now · <span className="tnum">{fmtMoneyCompact(s.value)}</span>
                </span>
              </span>
            </Tooltip>
          </div>
        </li>
      ))}
    </ol>
  )
}
