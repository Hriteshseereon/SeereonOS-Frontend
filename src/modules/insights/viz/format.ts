// Display formatting for server-computed chart values (formatting only — no maths beyond scaling for display).
import { useEffect, useRef, useState } from 'react'
import { fmtMoney, fmtMoneyCompact, fmtNum, fmtPct } from '@/domain/money'
import type { VizFormat } from '@/api/types/viz'

export function fmtViz(v: unknown, f: VizFormat | string = 'number', compact = false): string {
  const n = typeof v === 'number' ? v : v === null || v === undefined || v === '' ? NaN : Number(v)
  if (!Number.isFinite(n)) return '—'
  switch (f) {
    case 'money':
      return compact ? fmtMoneyCompact(n) : fmtMoney(n)
    case 'percent':
      return fmtPct(n, compact ? 0 : Math.abs(n) < 0.1 && n !== 0 ? 1 : 0)
    case 'hours':
      return `${fmtNum(n, compact || Number.isInteger(n) ? 0 : 1)}h`
    case 'days':
      return `${fmtNum(n, Number.isInteger(n) ? 0 : 1)}d`
    case 'ratio':
      return `×${n.toFixed(2)}`
    default:
      return compact && Math.abs(n) >= 1000 ? new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : fmtNum(n, Number.isInteger(n) ? 0 : 2)
  }
}

/** Width of an element (ResizeObserver) — charts lay out for phone / desktop from their own width, not the window. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dayNum = (d: string) => (ISO.test(d) ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000 : NaN)
export const fmtDay = (d: string | null | undefined) => (d && ISO.test(d) ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}` : '—')
export const monthLabel = (y: number, m: number) => `${MON[m]} ${String(y).slice(2)}`
