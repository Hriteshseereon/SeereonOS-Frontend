// PROJECT COST CALCULATOR (Feature Guide §3 / §6, checklist G3.10, G6.09). Shared by the create form and the
// project's Money tab. Every number comes from the server preview; this component only edits the draft.
import { AlertTriangle, Plus, X } from '@/ui/icons'
import type { CostingPreview } from '@/api/projects'
import { useDirectory } from '@/api/core'
import { fmtDate } from '@/domain/calendar'
import { fmtMoney, fmtNum, fmtPct } from '@/domain/money'
import { cn } from '@/lib/utils'
import { Button, Callout, IconButton, Input, Select } from '@/ui'
import { newKey, type CostingDraft, type DraftRow } from './costingDraft'
import { CostChain } from './CostChain'
import { CommercialsEditor } from './CommercialsEditor'
import { PeopleShare } from './PeopleShare'

export function CalendarLine({ preview, empty, manDays, className }: { preview: { summary: CostingPreview['summary'] } | null | undefined; empty?: string; manDays?: { total: number; rows: number } | null; className?: string }) {
  const s = preview?.summary
  return (
    <div className={cn('rounded-md bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2', className)}>
      {!s ? (
        empty ?? 'Pick a start and end date to see working days, weekends and holidays.'
      ) : (
        <>
          <span className="tnum">{fmtDate(s.from, 'long').replace(/^\w+, /, '')}</span> to <span className="tnum">{fmtDate(s.to, 'long').replace(/^\w+, /, '')}</span>:{' '}
          <span className="tnum">{s.calendar_days}</span> calendar days, <span className="tnum">{s.weekend_days}</span> weekend days,{' '}
          <span className="tnum" title={s.holiday_list.map((h) => `${fmtDate(h.date)} ${h.name}`).join('\n')}>{s.holidays}</span> holiday{s.holidays === 1 ? '' : 's'},{' '}
          <span className="tnum font-semibold text-ink">{s.working_days} working days</span>.
          {manDays && manDays.rows > 0 && (
            <>
              {' '}Total man-days <span className="tnum font-semibold text-ink">{fmtNum(manDays.total, 1)}</span> across <span className="tnum">{manDays.rows}</span> resource row{manDays.rows === 1 ? '' : 's'}.
            </>
          )}
          {s.holiday_list.length > 0 && <span className="block text-[12px] text-ink-3">Holidays: {s.holiday_list.map((h) => `${h.name} (${fmtDate(h.date)})`).join(', ')}</span>}
        </>
      )}
    </div>
  )
}

const HEAD = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3'
const LBL = 'mb-1 block text-[12px] font-medium text-ink-3 @min-[960px]:hidden'

export function CostingEditor({
  draft, onChange, preview, errors = {}, readOnly, loading, hideResources, hideTotals, hideCommercials, allowAll, showShare,
}: {
  draft: CostingDraft
  onChange: (d: CostingDraft) => void
  preview: Pick<CostingPreview, 'can_see_rates' | 'milestones' | 'totals' | 'contingency_pct' | 'markup_pct' | 'price_paise' | 'below_floor' | 'floor_pct' | 'min_hours' | 'warnings'> & { rows: CostingPreview['rows'] } | undefined
  errors?: Record<string, string>
  readOnly?: boolean
  loading?: boolean
  /** v7 (standalone cost calculator): the caller renders its own resource rows (people + role placeholders) */
  hideResources?: boolean
  /** v7: the caller shows the totals elsewhere (e.g. a side panel) */
  hideTotals?: boolean
  /** v9 wizard: resources on their own step (commercials on the next) */
  hideCommercials?: boolean
  /** v9: offer "All milestones" (rows span the project) — the wizard and projects without a WBS yet */
  allowAll?: boolean
  /** v9: per-person % share and the cost each person adds */
  showShare?: boolean
}) {
  const dir = useDirectory()
  const people = (dir.data ?? []).filter((p) => p.status === 'active')
  const seeRates = !!preview?.can_see_rates
  const ms = preview?.milestones ?? []
  // Feature Guide §6: the milestone is required (no "All"), so cost always lands on a milestone and a period
  const msOptions = [...(allowAll ? [{ value: '', label: 'All milestones' }] : []), ...ms.map((m) => ({ value: m.id ? `id:${m.id}` : `i:${m.index}`, label: m.code }))]
  const rowView = (i: number) => preview?.rows[i]
  const setRow = (key: string, patch: Partial<DraftRow>) => onChange({ ...draft, rows: draft.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })
  const t = preview?.totals
  const grid = seeRates
    ? '@min-[960px]:grid-cols-[minmax(150px,1fr)_84px_76px_136px_136px_58px_60px_80px_96px_36px]'
    : '@min-[960px]:grid-cols-[minmax(160px,1fr)_92px_80px_140px_140px_70px_70px_36px]'

  const addRow = () => {
    const first = ms[0]
    onChange({ ...draft, rows: [...draft.rows, { key: newKey('r'), id: null, user_id: null, ms: first && !allowAll ? (first.id ? `id:${first.id}` : `i:${first.index}`) : '', pct: '100', from_on: null, to_on: null }] })
  }

  return (
    <div className="@container space-y-6">
      {/* ---------------- resources ---------------- */}
      {!hideResources && <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h4 className="text-[14px] font-semibold">Resources</h4>
          {t && (
            <span className="tnum text-[12.5px] text-ink-3">
              {fmtNum(t.man_days, 1)} man-days · {t.people} {t.people === 1 ? 'person' : 'people'}
              {t.resources !== null && <> · {fmtMoney(t.resources)}</>}
            </span>
          )}
        </div>
        {draft.rows.length > 0 && (
          <div className={cn('hidden gap-2 border-b border-line pb-2 @min-[960px]:grid', grid)}>
            <span className={HEAD}>Resource</span>
            <span className={HEAD}>{allowAll ? 'Milestone' : 'Milestone *'}</span>
            <span className={HEAD}>Alloc. %</span>
            <span className={HEAD}>From *</span>
            <span className={HEAD}>To *</span>
            <span className={cn(HEAD, 'text-right')}>Work days</span>
            <span className={cn(HEAD, 'text-right')}>Man-days</span>
            {seeRates && <span className={cn(HEAD, 'text-right')}>Cost/day</span>}
            {seeRates && <span className={cn(HEAD, 'text-right')}>Cost</span>}
            <span />
          </div>
        )}
        <ul className="divide-y divide-line">
          {draft.rows.map((r, i) => {
            const v = rowView(i)
            const err = (f: string) => errors[`resources.${i}.${f}`]
            const rowErr = err('user_id') || err('milestone_id') || err('pct') || err('from_on') || err('to_on') || (v && v.key === r.key ? v.error : null)
            const fromVal = r.from_on ?? (v?.key === r.key ? v.from_on : null) ?? ''
            const toVal = r.to_on ?? (v?.key === r.key ? v.to_on : null) ?? ''
            return (
              <li key={r.key} className="py-2.5 @min-[960px]:py-2">
                <div className={cn('grid grid-cols-2 items-center gap-2 @min-[520px]:grid-cols-3', grid)}>
                  <label className="col-span-2 min-w-0 @min-[520px]:col-span-3 @min-[960px]:col-span-1">
                    <span className={LBL}>Resource</span>
                    <Select
                      aria-label={`Row ${i + 1} resource`}
                      value={r.user_id ?? ''}
                      disabled={readOnly}
                      invalid={!!err('user_id')}
                      placeholder={!r.user_id && r.role_label ? `Role: ${r.role_label} — assign a person` : 'Choose'}
                      onChange={(e) => setRow(r.key, { user_id: e.target.value || null })}
                      options={people.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className={LBL}>{allowAll ? 'Milestone' : 'Milestone *'}</span>
                    <Select aria-label={`Row ${i + 1} milestone`} value={r.ms} disabled={readOnly} invalid={!!err('milestone_id') || (!allowAll && !r.ms && !!r.user_id)} placeholder={allowAll ? undefined : '—'} onChange={(e) => setRow(r.key, { ms: e.target.value, from_on: null, to_on: null })} options={msOptions} />
                  </label>
                  <label className="min-w-0">
                    <span className={LBL}>Alloc. %</span>
                    <Input aria-label={`Row ${i + 1} allocation`} type="number" inputMode="numeric" min={1} max={100} step={5} value={r.pct} disabled={readOnly} invalid={!!err('pct')} onChange={(e) => setRow(r.key, { pct: e.target.value })} className="tnum" />
                  </label>
                  <label className="min-w-0">
                    <span className={LBL}>From *</span>
                    <Input aria-label={`Row ${i + 1} from`} type="date" value={fromVal} disabled={readOnly} invalid={!!err('from_on')} onChange={(e) => setRow(r.key, { from_on: e.target.value || null })} className="tnum" />
                  </label>
                  <label className="min-w-0">
                    <span className={LBL}>To *</span>
                    <Input aria-label={`Row ${i + 1} to`} type="date" value={toVal} min={fromVal || undefined} disabled={readOnly} invalid={!!err('to_on')} onChange={(e) => setRow(r.key, { to_on: e.target.value || null })} className="tnum" />
                  </label>
                  <Num label="Working days" value={v?.key === r.key ? fmtNum(v.working_days) : '—'} />
                  <Num label="Man-days" value={v?.key === r.key ? fmtNum(v.man_days, 1) : '—'} />
                  {seeRates && <Num label="Cost/day" value={v?.key === r.key && v.cost_per_day !== null ? fmtMoney(v.cost_per_day) : '—'} />}
                  {seeRates && <Num label="Cost" strong value={v?.key === r.key && v.cost !== null ? fmtMoney(v.cost) : '—'} />}
                  <div className="col-span-2 flex justify-end @min-[520px]:col-span-3 @min-[960px]:col-span-1">
                    {!readOnly && (
                      <IconButton label={`Remove row ${i + 1}`} size="sm" onClick={() => onChange({ ...draft, rows: draft.rows.filter((x) => x.key !== r.key) })}>
                        <X className="size-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
                {rowErr && <p className={cn('mt-1 text-[12.5px] font-medium', v?.error && !err('user_id') && !err('pct') && !err('from_on') && !err('to_on') && !err('milestone_id') && v.error.includes('no cost rate') ? 'text-warning-text' : 'text-danger-text')}>{rowErr}</p>}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
          {allowAll
            ? 'Choose a milestone, or All milestones to span the project; From and To default to those dates. Add the same person again for another milestone or period. Cost runs across every working day in the range, whether or not hours are logged.'
            : 'Choose the milestone each person works on (required); From and To are required and default to that milestone’s dates. Add the same person again for another milestone. Cost runs across every working day in the range, whether or not hours are logged.'}
        </p>
        {!readOnly && (
          <Button size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={addRow}>
            Add resource
          </Button>
        )}
        {showShare && t?.people_share && t.people_share.length > 0 && <PeopleShare className="mt-4" people={t.people_share} resources={t.resources} loading={loading} />}
      </section>}

      {/* ---------------- commercials (v9 D1): category lines, maintenance, contingency, profit margin ⇄ price ---------------- */}
      {!hideCommercials && (
        <section>
          <h4 className="mb-2 text-[14px] font-semibold">Commercials</h4>
          <CommercialsEditor draft={draft} onChange={onChange} preview={preview} errors={errors} readOnly={readOnly} />
        </section>
      )}

      {/* ---------------- totals ---------------- */}
      {!hideTotals && t && t.total_cost !== null && (
        <section aria-label="Planned price" className={cn('transition-opacity', loading && 'opacity-70')}>
          <CostChain t={t} contingencyPct={preview?.contingency_pct} markupPct={preview?.markup_pct} belowFloor={preview?.below_floor} />
          {preview?.below_floor && (
            <Callout tone="danger" icon={<AlertTriangle />} className="mt-3">
              Planned margin {fmtPct(t.margin)} is below the {preview.floor_pct}% floor. Raise the price or profit margin, or trim resources.
            </Callout>
          )}
          {seeRates && (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
              Cost per hour = monthly CTC ÷ (working days in the month × {preview?.min_hours ?? 9} minimum hours); cost/day = {preview?.min_hours ?? 9} × cost per hour. A row costs working days × % × cost/day, month by month. Total cost = resource cost + office & hardware + expenses + miscellaneous (+ maintenance); actual cost = total cost + contingency; price = actual cost × (1 + profit margin). Margin on cost = profit ÷ actual cost; margin on price = profit ÷ price.
            </p>
          )}
        </section>
      )}
      {preview && preview.warnings.filter((w) => !w.includes('floor')).length > 0 && (
        <Callout tone="warning" icon={<AlertTriangle />} title="Check allocations">
          {preview.warnings.filter((w) => !w.includes('floor')).map((w) => (
            <div key={w}>{w}</div>
          ))}
        </Callout>
      )}
    </div>
  )
}

function Num({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 @min-[960px]:text-right">
      <span className={LBL}>{label}</span>
      <span className={cn('tnum block whitespace-nowrap text-[13px]', strong ? 'font-medium text-ink' : 'text-ink-2')}>{value}</span>
    </div>
  )
}
