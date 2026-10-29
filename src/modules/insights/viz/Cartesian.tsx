// Column / bar / line charts for server-computed series (Recharts). Mark specs from the dataviz method: bars ≤ 24 px
// thick with a 4 px rounded data end and square baseline, a 2 px surface gap between stacked segments, 2 px lines,
// ≥ 8 px markers with a surface ring, hairline solid grid, one value axis only, reference lines dashed (they are
// thresholds, not grid). A lone series wears the brand colour; several series take the validated categorical slots in
// fixed order (identity follows the series key, never its rank). Ordered categories take one hue in ordered steps.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CartesianViz } from '@/api/types/viz'
import { fmtViz, useWidth } from './format'

const CAT = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)']
const ORD = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)', 'var(--ord-5)', 'var(--ord-6)']

/** Series colour: one series → brand; several → categorical slot i (fixed order). */
export const seriesColour = (i: number, n: number) => (n === 1 ? 'var(--brand)' : CAT[i % CAT.length])
export const ordinalColour = (i: number, n: number) => ORD[Math.min(ORD.length - 1, Math.round((i * (ORD.length - 1)) / Math.max(1, n - 1)))]

const axis = { stroke: 'var(--line-strong)', tick: { fill: 'var(--ink-3)', fontSize: 11.5 }, tickLine: false, axisLine: false } as const

function TipBody({ active, payload, label, fmt, lines }: { active?: boolean; payload?: { dataKey: string; name: string; value: number | null; color?: string; fill?: string; stroke?: string }[]; label?: string; fmt: string; lines?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[170px] max-w-[280px] rounded-md border border-line bg-elevated px-3 py-2.5 shadow-lg">
      <div className="mb-1.5 text-[12px] text-ink-3">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-2">
              <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: p.color ?? p.stroke ?? p.fill }} aria-hidden />
              <span className="truncate">{p.name}</span>
            </span>
            <span className="tnum text-[13px] font-semibold text-ink">{fmtViz(p.value, fmt)}</span>
          </div>
        ))}
      </div>
      {lines && null}
    </div>
  )
}

export function CartesianChart({ viz, height: hIn }: { viz: CartesianViz; height?: number }) {
  const nav = useNavigate()
  const [ref, width] = useWidth<HTMLDivElement>()
  const phone = width > 0 && width < 520
  const n = viz.series.length
  const data = useMemo(() => viz.categories.map((c, i) => Object.fromEntries([['__x', c], ['__i', i], ...viz.series.map((s) => [s.key, s.values[i]])])), [viz])
  const fmt = viz.format
  const horizontal = viz.kind === 'bar'
  const labelW = horizontal ? Math.min(phone ? 112 : 190, Math.max(72, Math.max(...viz.categories.map((c) => c.length)) * 7.2 + 8)) : 0
  const height = hIn ?? (horizontal ? Math.max(120, viz.categories.length * (n > 1 && !viz.stacked ? 18 * n + 14 : 30) + 40) : phone ? 220 : 260)
  const onClick = (i: number) => {
    const to = viz.links?.[i]
    if (to) nav(to)
  }
  const tickFmt = (v: number) => fmtViz(v, fmt, true)
  const trunc = (s: string) => {
    const max = Math.floor((labelW - 8) / 7.4)
    return s.length > max ? s.slice(0, Math.max(3, max - 1)) + '…' : s
  }
  const refs = (viz.refs ?? []).map((r) => (
    <ReferenceLine
      key={r.label}
      {...(horizontal ? { x: r.value } : { y: r.value })}
      stroke="var(--ink-3)"
      strokeDasharray="4 3"
      strokeWidth={1}
      ifOverflow="extendDomain"
      label={horizontal ? { value: r.label, position: 'top', fill: 'var(--ink-3)', fontSize: 11 } : undefined}
    />
  ))
  // let Recharts drop ticks that would collide (labels never overlap); keep first and last
  const xTickInterval = 'preserveStartEnd' as const
  return (
    <div ref={ref} className="w-full min-w-0" style={{ height }}>
      {width > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          {viz.kind === 'line' ? (
            <LineChart data={data} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="__x" {...axis} interval={xTickInterval} minTickGap={10} />
              <YAxis {...axis} width={fmt === 'money' ? 64 : 48} tickFormatter={tickFmt} allowDecimals={fmt !== 'number'} domain={fmt === 'percent' ? [0, (max: number) => Math.max(1, max)] : [0, 'auto']} />
              <Tooltip cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }} content={<TipBody fmt={fmt} />} />
              {refs}
              {viz.series.map((s, i) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="linear"
                  stroke={seriesColour(i, n)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={viz.categories.length <= 16 ? { r: 4, fill: seriesColour(i, n), stroke: 'var(--surface)', strokeWidth: 2 } : false}
                  activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: horizontal ? 18 : 14, right: horizontal ? 24 : 12, bottom: 0, left: 0 }} barCategoryGap={horizontal ? '24%' : '30%'} barGap={2}>
              <CartesianGrid stroke="var(--line)" vertical={horizontal} horizontal={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" {...axis} tickFormatter={tickFmt} allowDecimals={fmt !== 'number'} domain={[(min: number) => Math.min(0, min), 'auto']} />
                  <YAxis
                    type="category"
                    dataKey="__x"
                    {...axis}
                    width={labelW}
                    interval={0}
                    tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => (
                      <text x={x} y={y} dy={4} textAnchor="end" fill="var(--ink-3)" fontSize={11.5}>
                        <title>{payload.value}</title>
                        {trunc(payload.value)}
                      </text>
                    )}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="__x" {...axis} interval={xTickInterval} minTickGap={10} />
                  <YAxis {...axis} width={fmt === 'money' ? 64 : 48} tickFormatter={tickFmt} allowDecimals={fmt !== 'number'} />
                </>
              )}
              <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.8 }} content={<TipBody fmt={fmt} />} />
              {refs}
              {viz.series.map((s, i) => {
                const top = !viz.stacked || i === n - 1
                const radius: [number, number, number, number] = top ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : [0, 0, 0, 0]
                return (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId={viz.stacked ? 'a' : undefined}
                    fill={seriesColour(i, n)}
                    radius={radius}
                    stroke="var(--surface)"
                    strokeWidth={viz.stacked ? 2 : 0}
                    maxBarSize={24}
                    isAnimationActive={false}
                    cursor={viz.links ? 'pointer' : undefined}
                    onClick={(_: unknown, idx: number) => onClick(idx)}
                  >
                    {viz.ordinal && n === 1 && viz.categories.map((c, ci) => <Cell key={c} fill={ordinalColour(ci, viz.categories.length)} />)}
                  </Bar>
                )
              })}
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}

/** Legend for ≥ 2 series (a lone series needs none: the title names it). Rect keys for bars, line keys for lines. */
export function CartesianLegend({ viz }: { viz: CartesianViz }) {
  const n = viz.series.length
  if (n < 2 && !viz.refs?.length) return null
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
      {n > 1 && viz.series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          {viz.kind === 'line' ? <span className="h-[2px] w-3.5 rounded-full" style={{ background: seriesColour(i, n) }} /> : <span className="size-2.5 rounded-[2px]" style={{ background: seriesColour(i, n) }} />}
          {s.label}
        </li>
      ))}
      {(viz.refs ?? []).map((r) => (
        <li key={r.label} className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="w-3.5 border-t border-dashed border-ink-3" />
          {r.label}
        </li>
      ))}
    </ul>
  )
}
