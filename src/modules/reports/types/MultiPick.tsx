// Multi-select filter control: a button showing the picked values, a searchable checklist in a popover (a bottom-
// friendly width on phones), "Clear" to drop the filter.
import { useMemo, useState } from 'react'
import { Check, ChevronDown, X } from '@/ui/icons'
import { Popover } from '@/ui'
import { cn } from '@/lib/utils'

export interface PickOption {
  value: string
  label: string
  hint?: string
}

export function MultiPick({ id, value, onChange, options, placeholder = 'Any', noun = 'items' }: { id?: string; value: string[]; onChange: (v: string[]) => void; options: PickOption[]; placeholder?: string; noun?: string }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return options.filter((o) => !s || `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(s))
  }, [options, q])
  const sel = new Set(value)
  const label = value.length === 0 ? placeholder : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} ${noun}`
  const toggle = (v: string) => onChange(sel.has(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <Popover
      className="w-[min(92vw,320px)] p-0"
      trigger={
        <button
          id={id}
          type="button"
          className="flex h-[var(--ctl-h)] w-full min-w-0 items-center gap-2 rounded-md border border-line-strong/80 bg-surface px-3 text-left text-[14px] outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15"
        >
          <span className={cn('min-w-0 flex-1 truncate', !value.length && 'text-ink-3')}>{label}</span>
          {value.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation()
                onChange([])
              }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.stopPropagation(), onChange([]))}
              className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-4 shrink-0 text-ink-3" />
          )}
        </button>
      }
    >
      <div className="flex max-h-[360px] flex-col">
        {options.length > 8 && (
          <div className="border-b border-line px-3">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search options" className="h-10 w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto p-1 scroll-thin" role="listbox" aria-multiselectable="true">
          {shown.length === 0 && <li className="px-3 py-5 text-center text-[13px] text-ink-3">{options.length ? 'No matches' : 'Nothing to pick in your scope'}</li>}
          {shown.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={sel.has(o.value)} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] hover:bg-surface-2">
                <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border', sel.has(o.value) ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong')}>{sel.has(o.value) && <Check className="size-3" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[12px] text-ink-3">{o.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {value.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12.5px]">
            <span className="text-ink-3">{value.length} selected</span>
            <button type="button" className="font-medium text-brand-text hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
        )}
      </div>
    </Popover>
  )
}
