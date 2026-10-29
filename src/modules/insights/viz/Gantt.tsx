// Portfolio Gantt / milestone timeline / forecast ranges, drawn from server rows on one shared time axis with a
// today line. Status colours are the reserved status tokens and never carry meaning alone: every row has a status
// label, every mark a tooltip (hover AND keyboard focus) and the table view lists the same facts. On phones the label
// sits above its track so the axis keeps the full width (no horizontal scroll).
import { Link, useNavigate } from 'react-router-dom'
import type { GanttMarker, GanttRow, GanttState, GanttViz } from '@/api/types/viz'
import { Badge, Tooltip } from '@/ui'
import { cn } from '@/lib/utils'
import { dayNum, fmtDay, monthLabel, useWidth } from './format'

export const STATE_BG: Record<GanttState, string> = {
  on_track: 'bg-brand',
  due_soon: 'bg-info',
  at_risk: 'bg-warning',
  late: 'bg-danger',
  done: 'bg-ink-2',
  done_late: 'bg-ink-3',
  not_started: 'bg-ink-3/60',
  on_hold: 'bg-ink-3/60',
}
const STATE_SOFT: Record<GanttState, string> = {
  on_track: 'bg-brand/20',
  due_soon: 'bg-info/20',
  at_risk: 'bg-warning/25',
  late: 'bg-danger/20',
  done: 'bg-ink-3/20',
  done_late: 'bg-ink-3/20',
  not_started: 'bg-ink-3/15',
  on_hold: 'bg-ink-3/15',
}
const STATE_TONE: Record<GanttState, 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'brand'> = {
  on_track: 'success',
  due_soon: 'info',
  at_risk: 'warning',
  late: 'danger',
  done: 'success',
  done_late: 'neutral',
  not_started: 'neutral',
  on_hold: 'neutral',
}

function ticks(from: string, to: string, narrow: boolean): { at: number; label: string }[] {
  const a = dayNum(from)
  const b = dayNum(to)
  if (!(b > a)) return []
  const span = b - a
  const step = span > 720 ? 6 : span > 360 ? (narrow ? 6 : 3) : span > 150 ? (narrow ? 2 : 1) : 1
  const out = []
  const d = new Date(a * 86_400_000)
  let y = d.getUTCFullYear()
  let m = d.getUTCMonth() + 1
  if (m > 11) {
    m = 0
    y++
  }
  for (let k = 0; k < 60; k++) {
    const t = Date.UTC(y, m, 1) / 86_400_000
    if (t > b) break
    if (m % step === 0 || step === 1) out.push({ at: ((t - a) / span) * 100, label: monthLabel(y, m) })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return out
}

// V9-FIX (item 12): in the bar views the milestone markers sit in their own lane ABOVE the project bar, so a click on
// the bar opens the project and a click on a marker opens that milestone — neither covers the other. Both are buttons
// (Tab + Enter/Space), each with its own label and tooltip.
const LANE = { ms: 'top-0 h-[18px]', msMid: 'top-[9px]', bar: 'top-[27px]' }

function Diamond({ m, left, row, lane }: { m: GanttMarker; left: number; row: GanttRow; lane: boolean }) {
  const nav = useNavigate()
  return (
    <Tooltip
      content={
        <span className="block">
          <span className="block font-semibold">{m.label}</span>
          <span className="block font-normal opacity-80">
            {row.label} · {m.state_label}
          </span>
          <span className="block font-normal opacity-80">Planned {fmtDay(m.date)}{m.baseline ? ` · baseline ${fmtDay(m.baseline)}` : ''}{m.forecast && m.state !== 'done' ? ` · forecast ${fmtDay(m.forecast)}` : ''}</span>
        </span>
      }
    >
      <button
        type="button"
        aria-label={`${m.label}: ${m.state_label}, planned ${fmtDay(m.date)}${m.link ? ' — open the milestone' : ''}`}
        onClick={m.link ? () => nav(m.link!) : undefined}
        className={cn('viz-hit absolute z-[2] grid w-6 -translate-x-1/2 place-items-center rounded-sm', lane ? LANE.ms : 'top-1/2 size-6 -translate-y-1/2', m.link && 'cursor-pointer')}
        style={{ left: `${left}%` }}
      >
        <span className={cn('viz-diamond block size-2.5 rotate-45 rounded-[1px]', STATE_BG[m.state])} />
      </button>
    </Tooltip>
  )
}

function Track({ row, viz, pct }: { row: GanttRow; viz: GanttViz; pct: (d: string) => number }) {
  const nav = useNavigate()
  const clamp = (x: number) => Math.max(0, Math.min(100, x))
  const lane = viz.mode !== 'milestones' && row.markers.length > 0 // markers above the bar
  const barY = lane ? LANE.bar : 'top-1/2'
  const openRow = row.link ? () => nav(row.link!) : undefined
  const s = clamp(pct(row.start))
  const e = clamp(pct(row.end))
  const tip = (
    <span className="block">
      <span className="block font-semibold">{row.label}</span>
      <span className="block font-normal opacity-80">{row.status_label}</span>
      {row.detail.map((d) => (
        <span key={d} className="block font-normal opacity-80">
          {d}
        </span>
      ))}
    </span>
  )
  const inRange = (d: string) => {
    const x = pct(d)
    return x >= 0 && x <= 100
  }
  return (
    <div className={cn('relative', lane ? 'h-[36px]' : 'h-7')}>
      {viz.mode === 'milestones' ? (
        <span className="absolute top-1/2 h-px -translate-y-1/2 bg-line-strong" style={{ left: `${s}%`, width: `${Math.max(0.5, e - s)}%` }} aria-hidden />
      ) : viz.mode === 'forecast' ? (
        <>
          <Tooltip content={tip}>
            <button type="button" aria-label={`${row.label}: ${row.status_label}${openRow ? ' — open the project' : ''}`} onClick={openRow} className={cn('viz-hit absolute h-2 -translate-y-1/2 rounded-sm bg-surface-2 ring-1 ring-inset ring-line-strong', barY)} style={{ left: `${s}%`, width: `${Math.max(0.8, e - s)}%` }} />
          </Tooltip>
          {row.range && (
            <span
              className={cn('pointer-events-none absolute h-3.5 -translate-y-1/2 rounded-[4px]', barY, STATE_BG[row.status])}
              style={{ left: `${clamp(pct(row.range.from))}%`, width: `${Math.max(0.8, clamp(pct(row.range.to)) - clamp(pct(row.range.from)))}%` }}
              aria-hidden
            />
          )}
          <span className={cn('pointer-events-none absolute w-[2px] -translate-x-1/2 bg-ink', lane ? 'top-[18px] h-[18px]' : 'top-0 h-full')} style={{ left: `${e}%` }} aria-hidden />
        </>
      ) : (
        <>
          <Tooltip content={tip}>
            <button
              type="button"
              aria-label={`${row.label}: ${row.status_label}${openRow ? ' — open the project' : ''}`}
              onClick={openRow}
              className={cn('viz-hit absolute h-3.5 -translate-y-1/2 overflow-hidden rounded-[4px]', barY, STATE_SOFT[row.status], openRow && 'cursor-pointer')}
              style={{ left: `${s}%`, width: `${Math.max(0.8, e - s)}%` }}
            >
              <span className={cn('absolute inset-y-0 left-0', STATE_BG[row.status])} style={{ width: `${Math.round(Math.max(0, Math.min(1, row.progress ?? 0)) * 100)}%` }} />
            </button>
          </Tooltip>
          {row.forecast && inRange(row.forecast) && row.forecast > row.end && (
            <span className={cn('pointer-events-none absolute h-[3px] -translate-y-1/2 bg-danger', barY)} style={{ left: `${e}%`, width: `${Math.max(0.4, clamp(pct(row.forecast)) - e)}%` }} aria-hidden />
          )}
          {row.forecast && inRange(row.forecast) && (
            <span className={cn('pointer-events-none absolute w-[2px] -translate-x-1/2 rounded-full', lane ? 'top-[18px] h-[18px]' : 'top-1 h-5', row.forecast > row.end ? 'bg-danger' : 'bg-ink-2')} style={{ left: `${clamp(pct(row.forecast))}%` }} aria-hidden />
          )}
        </>
      )}
      {row.markers.map((m) =>
        m.baseline && inRange(m.baseline) && inRange(m.date) ? (
          <span key={`b-${m.label}`} aria-hidden>
            <span className={cn('pointer-events-none absolute h-px bg-ink-3', lane ? LANE.msMid : 'top-1/2')} style={{ left: `${Math.min(pct(m.baseline), pct(m.date))}%`, width: `${Math.abs(pct(m.date) - pct(m.baseline))}%` }} />
            <span className={cn('viz-diamond pointer-events-none absolute block size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border border-ink-3 bg-surface', lane ? LANE.msMid : 'top-1/2')} style={{ left: `${pct(m.baseline)}%` }} />
          </span>
        ) : null,
      )}
      {row.markers.filter((m) => inRange(m.date)).map((m) => (
        <Diamond key={`${m.label}-${m.date}`} m={m} left={pct(m.date)} row={row} lane={lane} />
      ))}
    </div>
  )
}

export function GanttChart({ viz }: { viz: GanttViz }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const narrow = width > 0 && width < 640
  const a = dayNum(viz.from)
  const span = Math.max(1, dayNum(viz.to) - a)
  const pct = (d: string) => ((dayNum(d) - a) / span) * 100
  const tk = ticks(viz.from, viz.to, narrow)
  const today = pct(viz.today)
  const label = (r: GanttRow) => (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        {r.link ? (
          <Link to={r.link} className="block truncate text-[13px] font-medium text-ink hover:text-brand-text hover:underline" title={r.label}>
            {r.label}
          </Link>
        ) : (
          <span className="block truncate text-[13px] font-medium text-ink">{r.label}</span>
        )}
        {r.sub && <span className="block truncate text-[11.5px] text-ink-3">{r.sub}</span>}
      </div>
      {r.status_label && (
        <Badge size="sm" tone={STATE_TONE[r.status]}>
          {r.status_label}
        </Badge>
      )}
    </div>
  )
  return (
    <div ref={ref} className="min-w-0">
      <div className={cn('grid', narrow ? 'grid-cols-1' : 'grid-cols-[minmax(180px,32%)_minmax(0,1fr)] gap-x-4')}>
        {!narrow && <div />}
        <div className="relative h-6 border-b border-line" aria-hidden>
          {tk.map((t) => (
            <span key={t.label} className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-3" style={{ left: `${Math.max(3, Math.min(97, t.at))}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <ul className="divide-y divide-line">
          {viz.rows.map((r) => (
            <li key={r.id} className={cn('grid items-center py-1.5', narrow ? 'grid-cols-1 gap-1' : 'grid-cols-[minmax(180px,32%)_minmax(0,1fr)] gap-x-4')}>
              {label(r)}
              <div className="relative">
                {tk.map((t) => (
                  <span key={t.label} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${t.at}%` }} aria-hidden />
                ))}
                {today >= 0 && today <= 100 && <span className="absolute -inset-y-1.5 z-[1] w-px bg-ink-2" style={{ left: `${today}%` }} aria-hidden />}
                <Track row={r} viz={viz} pct={pct} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn('mt-1 grid', narrow ? 'grid-cols-1' : 'grid-cols-[minmax(180px,32%)_minmax(0,1fr)] gap-x-4')}>
        {!narrow && <div />}
        <div className="relative h-4 text-[11px] text-ink-2">
          {today >= 0 && today <= 100 && (
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium" style={{ left: `${Math.max(6, Math.min(94, today))}%` }}>
              Today
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function GanttLegend({ viz }: { viz: GanttViz }) {
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Legend">
      {viz.legend.map((l) => (
        <li key={l.key} className="flex items-center gap-1.5">
          {viz.mode === 'milestones' ? <span className={cn('size-2.5 rotate-45 rounded-[1px]', STATE_BG[l.key])} /> : <span className={cn('h-2.5 w-3.5 rounded-[2px]', STATE_BG[l.key])} />}
          {l.label}
        </li>
      ))}
      {viz.mode !== 'forecast' && (
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 rounded-[1px] border border-ink-3 bg-surface" />
          Baseline date
        </li>
      )}
      {viz.mode === 'bars' && (
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-[2px] rounded-full bg-ink-2" />
          Forecast finish
        </li>
      )}
      {viz.mode === 'forecast' && (
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-[2px] bg-ink" />
          Planned end
        </li>
      )}
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-px bg-ink-2" />
        Today
      </li>
    </ul>
  )
}
