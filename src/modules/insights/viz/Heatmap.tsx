// Person × week utilisation heatmap: ONE sequential hue (light → dark = less → more), a divider between actual and
// planned weeks, overloaded cells outlined in the reserved danger colour and listed in the legend (state never rides on
// colour alone: the value is printed in every cell and the tooltip / table carry the note). Cells shrink to fit the
// card on phones; labels move above their row there.
import { Link } from 'react-router-dom'
import type { HeatmapViz } from '@/api/types/viz'
import { Tooltip } from '@/ui'
import { cn } from '@/lib/utils'
import { useWidth } from './format'

const BINS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.1] // upper bounds of steps 1..6; step 7 is above 110%
const stepOf = (v: number) => {
  const i = BINS.findIndex((b) => v < b)
  return (i === -1 ? BINS.length : i) + 1
}

function cellStyle(v: number | null) {
  if (v === null) return { background: 'var(--viz-null)' }
  const s = stepOf(v)
  return { background: `var(--seq-${s})`, color: `var(--seq-ink-${s})` }
}

export function Heatmap({ viz }: { viz: HeatmapViz }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const narrow = width > 0 && width < 640
  const n = viz.cols.length
  const grid = narrow ? `repeat(${n}, minmax(0, 1fr))` : `minmax(150px, 22%) repeat(${n}, minmax(0, 1fr))`
  const over = viz.thresholds.over
  return (
    <div ref={ref} className="min-w-0" role="table" aria-label={viz.title}>
      {narrow && n > 0 && (
        <p className="pb-1 text-[11px] text-ink-3">
          Weeks starting {viz.cols[0].label} – {viz.cols[n - 1].label} (day of the month shown); actual before the divider, plan after
        </p>
      )}
      <div role="row" className="grid items-end gap-[2px] pb-1" style={{ gridTemplateColumns: grid }}>
        {!narrow && <span role="columnheader" className="text-[11px] text-ink-3" />}
        {viz.cols.map((c, i) => (
          <span role="columnheader" key={c.key} className={cn('min-w-0 text-center leading-tight', viz.split === i && 'border-l-2 border-ink-2 pl-[1px]')}>
            <span className="block truncate text-[10.5px] text-ink-2 md:text-[11px]">{narrow ? c.label.slice(0, 2) : c.label}</span>
            {!narrow && (i === 0 || viz.split === i) && <span className="block truncate text-[10px] text-ink-3">{c.sub}</span>}
          </span>
        ))}
      </div>
      <div className="space-y-[2px]">
        {viz.rows.map((r) => (
          <div key={r.id} role="row">
            {narrow && (
              <div className="truncate pb-0.5 pt-1.5 text-[12.5px] font-medium text-ink">
                {r.label}
                {r.sub && <span className="font-normal text-ink-3"> · {r.sub}</span>}
              </div>
            )}
            <div className="grid items-center gap-[2px]" style={{ gridTemplateColumns: grid }}>
              {!narrow && (
                <span role="rowheader" className="min-w-0 pr-2">
                  {r.link ? (
                    <Link to={r.link} className="block truncate text-[13px] font-medium text-ink hover:underline">
                      {r.label}
                    </Link>
                  ) : (
                    <span className="block truncate text-[13px] font-medium text-ink">{r.label}</span>
                  )}
                  {r.sub && <span className="block truncate text-[11.5px] text-ink-3">{r.sub}</span>}
                </span>
              )}
              {r.cells.map((c, i) => {
                const flag = c.v !== null && c.v > over
                return (
                  <Tooltip key={i} content={<span className="block"><span className="block font-semibold">{r.label} · week of {viz.cols[i].label}</span><span className="block font-normal opacity-80">{c.v === null ? '—' : `${Math.round(c.v * 100)}%`} · {c.note}</span></span>}>
                    <span
                      role="cell"
                      tabIndex={0}
                      aria-label={`${r.label}, week of ${viz.cols[i].label} (${viz.cols[i].sub}): ${c.v === null ? 'no capacity' : `${Math.round(c.v * 100)}%`}${flag ? ', overloaded' : ''}`}
                      className={cn(
                        'viz-cell viz-hit relative grid h-8 min-w-0 place-items-center rounded-[3px] text-[10.5px] font-medium tnum md:h-9 md:text-[11.5px]',
                        c.v === null && 'text-ink-3',
                        viz.split === i && 'ml-[2px]',
                        flag && 'ring-2 ring-inset ring-danger',
                      )}
                      style={cellStyle(c.v)}
                    >
                      {c.v === null ? '—' : Math.round(c.v * 100)}
                    </span>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeatmapLegend({ viz }: { viz: HeatmapViz }) {
  const labels = ['<20', '20–40', '40–60', '60–80', '80–100', '100–110', '>110']
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="text-ink-3">%</span>
        <span className="flex gap-px">
          {labels.map((l, i) => (
            <span key={l} className="flex w-9 flex-col items-center sm:w-11">
              <span className="h-2.5 w-full" style={{ background: `var(--seq-${i + 1})` }} />
              <span className="tnum mt-0.5 whitespace-nowrap text-[9.5px] text-ink-3 sm:text-[10px]">{l}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] ring-2 ring-inset ring-danger" style={{ background: 'var(--seq-7)' }} />
        Over {Math.round(viz.thresholds.over * 100)}% (overloaded)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-[2px] bg-ink-2" />
        Actual | planned
      </span>
    </div>
  )
}
