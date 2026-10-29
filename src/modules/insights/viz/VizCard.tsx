// One chart in a card: the title states the finding, the subtitle says what is plotted and in which unit, a legend
// for ≥ 2 series, a Chart / Table switch (every chart has a table twin — values never hide behind a hover), and an
// empty state when there is nothing to plot. Refetches keep the previous render (placeholder data) at reduced opacity.
import { useState, type ReactNode, type RefObject } from 'react'
import type { CartesianViz, FunnelViz, GanttViz, HeatmapViz, Viz } from '@/api/types/viz'
import { Card, DonutChart, EmptyState, Segmented } from '@/ui'
import { BarChart3 } from '@/ui/icons'
import { cn } from '@/lib/utils'
import { CartesianChart, CartesianLegend } from './Cartesian'
import { Funnel } from './Funnel'
import { GanttChart, GanttLegend } from './Gantt'
import { Heatmap, HeatmapLegend } from './Heatmap'
import { fmtDay, fmtViz } from './format'
import './viz.css'

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-3', right ? 'text-right' : 'text-left')}>{children}</th>
}
function Td({ children, right, strong }: { children: ReactNode; right?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-[13px]', right && 'tnum whitespace-nowrap text-right', strong && 'font-medium text-ink')}>{children}</td>
}
function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto scroll-thin md:-mx-5">
      <table className="w-full min-w-[420px] border-collapse">{children}</table>
    </div>
  )
}

export function VizTable({ viz }: { viz: Viz }) {
  if (viz.kind === 'gantt') {
    const g = viz as GanttViz
    return (
      <TableWrap>
        <thead className="border-b border-line">
          <tr>
            <Th>Row</Th>
            <Th>Status</Th>
            {g.mode === 'forecast' ? (
              <>
                <Th right>Planned end</Th>
                <Th right>P50</Th>
                <Th right>P80</Th>
              </>
            ) : (
              <>
                <Th right>Start</Th>
                <Th right>End</Th>
                {g.mode === 'bars' && <Th right>Forecast</Th>}
                <Th>Milestones</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {g.rows.map((r) => (
            <tr key={r.id}>
              <Td strong>{r.label}</Td>
              <Td>{r.status_label || '—'}</Td>
              {g.mode === 'forecast' ? (
                <>
                  <Td right>{fmtDay(r.end)}</Td>
                  <Td right>{fmtDay(r.range?.from)}</Td>
                  <Td right>{fmtDay(r.range?.to)}</Td>
                </>
              ) : (
                <>
                  <Td right>{fmtDay(r.start)}</Td>
                  <Td right>{fmtDay(r.end)}</Td>
                  {g.mode === 'bars' && <Td right>{fmtDay(r.forecast)}</Td>}
                  <Td>{r.markers.length ? r.markers.map((m) => `${m.label} (${fmtDay(m.date)}, ${m.state_label.toLowerCase()})`).join('; ') : '—'}</Td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    )
  }
  if (viz.kind === 'heatmap') {
    const h = viz as HeatmapViz
    return (
      <TableWrap>
        <thead className="border-b border-line">
          <tr>
            <Th>Person</Th>
            {h.cols.map((c) => (
              <Th key={c.key} right>
                {c.label}
                <span className="block text-[10px] font-normal normal-case tracking-normal">{c.sub}</span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {h.rows.map((r) => (
            <tr key={r.id}>
              <Td strong>{r.label}</Td>
              {r.cells.map((c, i) => (
                <Td key={i} right>
                  {c.v === null ? '—' : fmtViz(c.v, 'percent', true)}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    )
  }
  if (viz.kind === 'funnel') {
    const f = viz as FunnelViz
    return (
      <TableWrap>
        <thead className="border-b border-line">
          <tr>
            <Th>Stage</Th>
            <Th right>Reached</Th>
            <Th right>Now</Th>
            <Th right>Value now</Th>
            <Th right>Conversion</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {f.stages.map((s) => (
            <tr key={s.key}>
              <Td strong>{s.label}</Td>
              <Td right>{s.reached}</Td>
              <Td right>{s.count}</Td>
              <Td right>{fmtViz(s.value, 'money')}</Td>
              <Td right>{s.conversion === null ? '—' : fmtViz(s.conversion, 'percent', true)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    )
  }
  const c = viz as CartesianViz
  return (
    <TableWrap>
      <thead className="border-b border-line">
        <tr>
          <Th>{c.x_label ?? ''}</Th>
          {c.series.map((s) => (
            <Th key={s.key} right>
              {s.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {c.categories.map((cat, i) => (
          <tr key={`${cat}-${i}`}>
            <Td strong>{cat}</Td>
            {c.series.map((s) => (
              <Td key={s.key} right>
                {fmtViz(s.values[i], c.format)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}

export function VizBody({ viz, chartRef }: { viz: Viz; chartRef?: RefObject<HTMLDivElement> }) {
  switch (viz.kind) {
    case 'gantt':
      return (
        <>
          <GanttLegend viz={viz} />
          <GanttChart viz={viz} />
        </>
      )
    case 'heatmap':
      return (
        <>
          <HeatmapLegend viz={viz} />
          <Heatmap viz={viz} />
        </>
      )
    case 'funnel':
      return <Funnel viz={viz} />
    case 'donut': {
      const s = viz.series[0]
      return (
        <div ref={chartRef}>
          <DonutChart data={viz.categories.map((c, i) => ({ name: c, value: Number(s?.values[i] ?? 0) }))} format={viz.format === 'money' || viz.format === 'percent' || viz.format === 'hours' ? viz.format : 'number'} />
        </div>
      )
    }
    default:
      return (
        <div ref={chartRef}>
          <CartesianLegend viz={viz} />
          <CartesianChart viz={viz} />
        </div>
      )
  }
}

/** null when there is something to draw, else the message to show instead (the server's when it sent one) */
function isEmpty(v: Viz): string | null {
  if (v.kind === 'gantt' || v.kind === 'heatmap') return v.rows.length ? null : v.empty || 'Nothing to show.'
  if (v.kind === 'funnel') return v.stages.some((s) => s.reached) ? null : v.empty || 'No deals yet.'
  if (v.empty) return v.empty
  return v.categories.length && v.series.some((s) => s.values.some((x) => x !== null && x !== 0)) ? null : 'Nothing to plot for this selection.'
}

export function VizCard({ viz, fetching, chartRef, action, className }: { viz: Viz; fetching?: boolean; chartRef?: RefObject<HTMLDivElement>; action?: ReactNode; className?: string }) {
  const [mode, setMode] = useState<'chart' | 'table'>('chart')
  const empty = isEmpty(viz)
  return (
    <Card className={cn('min-w-0', className)}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-snug text-ink">{viz.title}</h3>
          {viz.subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{viz.subtitle}</p>}
        </div>
        {!empty && (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
          </div>
        )}
      </div>
      <div className={cn('min-w-0 transition-opacity', fetching && 'opacity-60')}>
        {empty ? <EmptyState compact icon={<BarChart3 />} title="Nothing to chart" body={empty} /> : mode === 'chart' ? <VizBody viz={viz} chartRef={chartRef} /> : <VizTable viz={viz} />}
      </div>
    </Card>
  )
}
