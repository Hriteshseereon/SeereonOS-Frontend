// Report-type builder (D9): period, filters (project, customer, team, person, status), the fields to show (in the
// order picked), one group-by, sort and the chart. It only edits a configuration — the server validates it again and
// computes everything when the report runs.
import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Plus, X } from '@/ui/icons'
import type { ReportChartChoice, ReportFilterKey, ReportTypeConfig, ReportTypeDef } from '@/api/types/viz'
import { Button, Card, Field, Input, Segmented, Select } from '@/ui'
import { PRESET_LABEL } from '@/reports/datasets'
import { cn } from '@/lib/utils'
import { MultiPick } from './MultiPick'

export function defaultConfig(def: ReportTypeDef): Required<Omit<ReportTypeConfig, 'sort'>> & { sort: ReportTypeConfig['sort'] } {
  return {
    fields: def.default_fields,
    period: { preset: def.default_period },
    filters: {},
    group_by: def.default_group,
    sort: def.default_group ? null : def.fields.some((f) => f.key === def.default_sort.field) ? def.default_sort : null,
    chart: 'auto',
    chart_by: def.default_chart_by,
  }
}

const FILTER_LABEL: Record<Exclude<ReportFilterKey, 'period'>, string> = { project: 'Project', customer: 'Customer', team: 'Team', person: 'Person', status: 'Status' }
const FILTER_NOUN: Record<Exclude<ReportFilterKey, 'period'>, string> = { project: 'projects', customer: 'customers', team: 'teams', person: 'people', status: 'statuses' }
const CHART_LABEL: Record<ReportChartChoice, string> = { auto: 'Auto', bar: 'Bars', column: 'Columns', line: 'Line', donut: 'Donut', none: 'No chart' }

function Section({ title, hint, children, className }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('min-w-0', className)}>
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-[12.5px] text-ink-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </Card>
  )
}

export type BuilderErrors = Partial<Record<'period' | 'fields', string>>

export function validateConfig(def: ReportTypeDef, c: ReportTypeConfig): BuilderErrors {
  const e: BuilderErrors = {}
  if (!c.fields?.length) e.fields = 'Pick at least one field to show.'
  const p = c.period ?? {}
  if (def.has_period && p.preset === undefined) {
    if (!p.from || !p.to) e.period = 'Pick both a start and an end date.'
    else if (p.to < p.from) e.period = 'The end date is before the start date.'
  }
  return e
}

export function TypeBuilder({ def, value, onChange, errors }: { def: ReportTypeDef; value: ReportTypeConfig; onChange: (c: ReportTypeConfig) => void; errors: BuilderErrors }) {
  const set = (patch: Partial<ReportTypeConfig>) => onChange({ ...value, ...patch })
  const fm = useMemo(() => new Map(def.fields.map((f) => [f.key, f])), [def])
  const fields = value.fields ?? []
  const unused = def.fields.filter((f) => !fields.includes(f.key))
  const custom = value.period?.preset === undefined
  const filterKeys = def.filters.filter((f): f is Exclude<ReportFilterKey, 'period'> => f !== 'period')
  const opts = def.options
  const optionsFor = (k: Exclude<ReportFilterKey, 'period'>) =>
    k === 'team' ? (opts?.team ?? []).map((t) => ({ value: t.value, label: t.label, hint: t.kind === 'department' ? 'Department' : undefined })) : k === 'status' ? (opts?.status ?? []) : (opts?.[k] ?? []).map((v) => ({ value: v, label: v }))
  const move = (k: string, d: -1 | 1) => {
    const i = fields.indexOf(k)
    const j = i + d
    if (i < 0 || j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ fields: next })
  }
  const numeric = (k: string) => ['money', 'number', 'percent'].includes(fm.get(k)?.type ?? '')
  const grouped = !!value.group_by
  const groupKey = value.group_by?.split(':')[0]
  const sortOptions = grouped
    ? [{ value: groupKey!, label: def.groups.find((g) => g.value === value.group_by)?.label ?? groupKey! }, { value: 'count', label: def.noun }, ...fields.filter((k) => numeric(k) && k !== groupKey).map((k) => ({ value: k, label: fm.get(k)!.label }))]
    : fields.map((k) => ({ value: k, label: fm.get(k)?.label ?? k }))
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {def.has_period && (
        <Section title="Period" hint={def.date_label ? `Applies to ${def.date_label.toLowerCase()}.` : undefined}>
          <div className="space-y-3">
            <Field label="Range" htmlFor="rt-period" error={errors.period}>
              <Select
                id="rt-period"
                value={custom ? 'custom' : value.period?.preset ?? def.default_period}
                onChange={(e) => (e.target.value === 'custom' ? set({ period: { from: value.period?.from ?? '', to: value.period?.to ?? '' } }) : set({ period: { preset: e.target.value } }))}
                options={[...Object.entries(PRESET_LABEL).map(([k, v]) => ({ value: k, label: v })), { value: 'custom', label: 'Custom dates…' }]}
              />
            </Field>
            {custom && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" htmlFor="rt-from">
                  <Input id="rt-from" type="date" value={value.period?.from ?? ''} onChange={(e) => set({ period: { from: e.target.value, to: value.period?.to ?? '' } })} invalid={!!errors.period} />
                </Field>
                <Field label="To" htmlFor="rt-to">
                  <Input id="rt-to" type="date" value={value.period?.to ?? ''} onChange={(e) => set({ period: { from: value.period?.from ?? '', to: e.target.value } })} invalid={!!errors.period} />
                </Field>
              </div>
            )}
          </div>
        </Section>
      )}
      {filterKeys.length > 0 && (
        <Section title="Filters" hint="Leave a filter empty to include everything you can see.">
          <div className="grid gap-3 sm:grid-cols-2">
            {filterKeys.map((k) => (
              <Field key={k} label={FILTER_LABEL[k]} htmlFor={`rt-f-${k}`}>
                <MultiPick id={`rt-f-${k}`} value={value.filters?.[k] ?? []} noun={FILTER_NOUN[k]} options={optionsFor(k)} onChange={(v) => set({ filters: { ...(value.filters ?? {}), [k]: v } })} placeholder={`All ${FILTER_NOUN[k]}`} />
              </Field>
            ))}
          </div>
        </Section>
      )}
      <Section title="Fields" hint="Columns of the detail table, in this order. When the report is grouped, number fields become the summed (or averaged) columns." className="lg:col-span-2">
        {errors.fields && <p className="mb-2 text-[12.5px] font-medium text-danger-text">{errors.fields}</p>}
        <ol className="flex flex-wrap gap-1.5" aria-label="Fields shown">
          {fields.map((k, i) => (
            <li key={k} className="flex h-8 items-center gap-0.5 rounded-md border border-brand/40 bg-brand-soft pl-2.5 pr-1 text-[13px] text-brand-text">
              <span className="mr-1 max-w-[180px] truncate font-medium">{fm.get(k)?.label ?? k}</span>
              <button type="button" aria-label={`Move ${fm.get(k)?.label} left`} disabled={i === 0} onClick={() => move(k, -1)} className="grid size-6 place-items-center rounded hover:bg-brand/10 disabled:opacity-30">
                <ArrowLeft className="size-3.5" />
              </button>
              <button type="button" aria-label={`Move ${fm.get(k)?.label} right`} disabled={i === fields.length - 1} onClick={() => move(k, 1)} className="grid size-6 place-items-center rounded hover:bg-brand/10 disabled:opacity-30">
                <ArrowRight className="size-3.5" />
              </button>
              <button type="button" aria-label={`Remove ${fm.get(k)?.label}`} onClick={() => set({ fields: fields.filter((x) => x !== k) })} className="grid size-6 place-items-center rounded hover:bg-brand/10">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {!fields.length && <li className="text-[13px] text-ink-3">No fields picked.</li>}
        </ol>
        {unused.length > 0 && (
          <>
            <div className="mb-1.5 mt-4 text-[12px] font-medium text-ink-3">Add a field</div>
            <div className="flex flex-wrap gap-1.5">
              {unused.map((f) => (
                <button key={f.key} type="button" onClick={() => set({ fields: [...fields, f.key] })} className="flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink-2 transition hover:border-line-strong hover:bg-surface-2 hover:text-ink">
                  <Plus className="size-3.5" />
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="mt-3 flex gap-2">
          <Button size="xs" variant="ghost" onClick={() => set({ fields: def.default_fields })}>
            Reset to defaults
          </Button>
          <Button size="xs" variant="ghost" onClick={() => set({ fields: def.fields.map((f) => f.key) })}>
            Add all
          </Button>
        </div>
      </Section>
      <Section title="Group & sort" hint="Group to get one row per value (with counts and totals), or list every row.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Group by" htmlFor="rt-group">
            <Select id="rt-group" value={value.group_by ?? ''} onChange={(e) => set({ group_by: e.target.value || null, sort: null })} options={[{ value: '', label: 'No grouping — list every row' }, ...def.groups]} />
          </Field>
          <Field label="Sort by" htmlFor="rt-sort">
            <Select id="rt-sort" value={value.sort?.field ?? ''} onChange={(e) => set({ sort: e.target.value ? { field: e.target.value, dir: value.sort?.dir ?? 'desc' } : null })} options={[{ value: '', label: grouped ? 'Default order' : 'Default order' }, ...sortOptions]} />
          </Field>
        </div>
        {value.sort?.field && (
          <div className="mt-3">
            <Segmented size="sm" value={value.sort.dir} onChange={(dir) => set({ sort: { field: value.sort!.field, dir } })} options={[{ value: 'desc', label: 'Highest / latest first' }, { value: 'asc', label: 'Lowest / earliest first' }]} />
          </div>
        )}
      </Section>
      <Section title="Chart" hint="The chart sits above the table; its title states what it shows.">
        <div className="space-y-3">
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <Segmented size="sm" value={value.chart ?? 'auto'} onChange={(chart) => set({ chart })} options={def.charts.map((c) => ({ value: c, label: CHART_LABEL[c] }))} />
          </div>
          {value.chart !== 'none' && (
            <Field label="Chart by" htmlFor="rt-chart-by">
              <Select id="rt-chart-by" value={value.chart_by ?? def.default_chart_by} onChange={(e) => set({ chart_by: e.target.value })} options={def.chart_by} />
            </Field>
          )}
        </div>
      </Section>
    </div>
  )
}
