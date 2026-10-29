// Holidays & calendars (v9, D10). Several holiday calendars per company, one per location group: each location uses a
// calendar (else the default one) and a person's working days, leave days and timesheet targets follow the calendar of
// their location (server: app/engine/holiday_cal.py). Reached from Team & settings › Holidays (everyone: their own
// calendar) and from Admin › Organisation setup › Holiday calendars (variant "setup": calendars + locations).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Download, FileUp, MapPin, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from '@/ui/icons'
import { useMut } from '@/api/query'
import { adminSetupApi, useCalendarHolidays, useHolidayCalendars, type HolidayCalendarRow, type HolidayCalendarsView, type HolidayImportRow } from '@/api/adminSetup'
import { useSession } from '@/stores/session'
import { dayKind, parseISO, todayISO, type CalendarCtx } from '@/domain/calendar'
import type { Holiday } from '@/types/entities'
import { Badge, Button, Callout, Checkbox, Dialog, EmptyState, ErrorState, Field, FileUpload, IconButton, Input, Menu, PageHeader, Segmented, Select, SkeletonRows, Textarea, useCan, useConfirm, useReadOnly } from '@/ui'
import { cn, groupBy, parseCSV, readFileAsText, saveFile, toCSV } from '@/lib/utils'
import { errField } from './kit'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HolidaysPage({ variant = 'settings' }: { variant?: 'settings' | 'setup' }) {
  const thisYear = Number(todayISO().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const cq = useHolidayCalendars(year)
  const cv = cq.data
  const [calId, setCalId] = useState<string | null>(null)
  // a calendar just created is selected before the list refetch brings it in: keep it selected meanwhile
  const created = useRef<string | null>(null)
  // start on the viewer's own calendar (their location), else the default
  useEffect(() => {
    if (!cv) return
    const known = !!calId && cv.calendars.some((c) => c.id === calId)
    if (known && created.current === calId) created.current = null
    if (!known && !(calId && created.current === calId)) setCalId(cv.my_calendar_id ?? cv.default_id)
  }, [cv, calId])
  const q = useCalendarHolidays(year, calId)
  const c = useCan()
  const readOnly = useReadOnly()
  const canEdit = c('holidays.edit') && !readOnly
  const { tenant } = useSession()
  const { confirm } = useConfirm()
  const [edit, setEdit] = useState<Holiday | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calDialog, setCalDialog] = useState<HolidayCalendarRow | 'new' | null>(null)
  const [assign, setAssign] = useState<HolidayCalendarRow | null>(null)
  const cal = cv?.calendars.find((x) => x.id === calId) ?? null

  const del = useMut((h: Holiday) => adminSetupApi.deleteHoliday(h.id), { success: (_, h) => `${h.name} deleted` })
  const ctx: CalendarCtx | null = useMemo(() => (tenant && q.data ? { settings: tenant.settings, holidays: q.data.holidays } : null), [tenant, q.data])
  const byMonth = useMemo(() => groupBy(q.data?.holidays ?? [], (h) => Number(h.date.slice(5, 7)) - 1), [q.data])
  const totalWorking = (q.data?.months ?? []).reduce((s, m) => s + m.working_days, 0)
  const mandatory = (q.data?.holidays ?? []).filter((h) => !h.optional).length
  const many = (cv?.calendars.length ?? 1) > 1
  const exportCsv = () =>
    saveFile(`holidays-${year}${many && cal ? '-' + cal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.csv`, toCSV([['date', 'name', 'optional'], ...(q.data?.holidays ?? []).map((h) => [h.date, h.name, h.optional ? 'yes' : 'no'])]), 'text/csv')

  return (
    <div>
      <PageHeader
        title={variant === 'setup' ? 'Holiday calendars' : 'Holidays & calendar'}
        subtitle={
          variant === 'setup'
            ? 'One calendar per group of locations. People follow the calendar of their location: it decides their working days, leave days and timesheet targets.'
            : canEdit
              ? 'Holidays and weekly offs decide working days for timesheets, SLA and payroll.'
              : 'Your holidays and working days. Only admins can change them.'
        }
        actions={
          <>
            {q.data && q.data.holidays.length > 0 && (
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={exportCsv}>
                CSV
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="sm" icon={<FileUp className="size-3.5" />} onClick={() => setImporting(true)} disabled={!calId}>
                  Import
                </Button>
                <Button size="sm" variant="primary" icon={<CalendarPlus className="size-3.5" />} onClick={() => setEdit('new')} disabled={!calId}>
                  Add holiday
                </Button>
              </>
            )}
          </>
        }
      />

      {cq.error && <ErrorState error={cq.error} onRetry={() => cq.refetch()} />}
      {cv && variant === 'setup' && <CalendarCards view={cv} selected={calId} onSelect={setCalId} canEdit={canEdit} onNew={() => setCalDialog('new')} onEdit={setCalDialog} onAssign={setAssign} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-line bg-surface">
            <IconButton size="sm" label="Previous year" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="tnum min-w-[56px] text-center text-[14px] font-medium">{year}</span>
            <IconButton size="sm" label="Next year" onClick={() => setYear((y) => y + 1)} disabled={year >= thisYear + 2}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
          {cv && variant === 'settings' && many && (
            <Select aria-label="Holiday calendar" className="w-[220px] max-w-full" value={calId ?? ''} onChange={(e) => setCalId(e.target.value)} options={cv.calendars.map((x) => ({ value: x.id, label: `${x.name}${x.id === cv.my_calendar_id ? ' (yours)' : ''}` }))} />
          )}
          {cv && variant === 'settings' && canEdit && (
            <Link to="/setup/holidays" className="text-[13px] font-medium text-brand-text hover:underline">
              Manage calendars
            </Link>
          )}
        </div>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }]} />
      </div>

      {q.isLoading || !calId ? (
        <SkeletonRows rows={6} />
      ) : q.error || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {variant === 'setup' && cal && (
            <h2 className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[14px] font-semibold">
              {cal.name}
              {cal.is_default && <Badge size="sm" tone="brand">Default</Badge>}
              {!cal.active && <Badge size="sm" tone="danger">Off</Badge>}
            </h2>
          )}
          <div className="mb-5 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {[
              ['Holidays', `${mandatory}`, q.data.holidays.length - mandatory ? `+${q.data.holidays.length - mandatory} optional` : 'all mandatory'],
              ['Working days', `${totalWorking}`, `in ${year}`],
              ['Saturdays', tenant?.settings['calendar.saturday_rule'] === 'all_off' ? 'All off' : tenant?.settings['calendar.saturday_rule'] === 'all_on' ? 'Working' : tenant?.settings['calendar.saturday_off_weeks'].map((n) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1]).join(' & ') + ' off', 'weekly rule'],
            ].map(([k, v, s]) => (
              <div key={k} className="min-w-0 px-3.5 py-3 md:px-4">
                <div className="text-[12.5px] leading-tight text-ink-3">{k}</div>
                <div className="tnum mt-1.5 text-[16px] font-semibold leading-tight md:text-[20px]">{v}</div>
                <div className="mt-0.5 truncate text-[12px] text-ink-3">{s}</div>
              </div>
            ))}
          </div>

          {view === 'calendar' && ctx ? (
            <YearCalendar year={year} cal={ctx} months={q.data.months} />
          ) : q.data.holidays.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={<CalendarPlus />}
                title={`No holidays for ${year}${many && cal ? ` in ${cal.name}` : ''}`}
                body={canEdit ? 'Add them one by one or import a CSV of date,name. Holidays reduce working days and pause the approval SLA.' : 'Your admin hasn’t added holidays for this year yet.'}
                action={
                  canEdit && (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setImporting(true)} icon={<FileUp className="size-4" />}>
                        Import CSV
                      </Button>
                      <Button variant="primary" onClick={() => setEdit('new')} icon={<CalendarPlus className="size-4" />}>
                        Add holiday
                      </Button>
                    </div>
                  )
                }
              />
            </div>
          ) : (
            <div className="space-y-5">
              {MONTHS.map((m, i) =>
                byMonth[i]?.length ? (
                  <section key={m}>
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                      <h2 className="text-[13.5px] font-semibold text-ink">{m}</h2>
                      <span className="tnum text-[12px] text-ink-3">{q.data!.months[i].working_days} working days</span>
                    </div>
                    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                      {byMonth[i].map((h) => {
                        const d = parseISO(h.date)
                        const past = h.date < todayISO()
                        return (
                          <div key={h.id} className={cn('flex items-center gap-3 px-4 py-2.5', past && 'opacity-60')}>
                            <div className="tnum w-[52px] shrink-0 whitespace-nowrap text-[13.5px] font-medium text-ink">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-medium">{h.name}</div>
                              <div className="text-[12.5px] text-ink-3">
                                {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                                {ctx && dayKind(h.date, { ...ctx, holidays: new Set() }) === 'weekly_off' && ' · falls on a weekly off'}
                              </div>
                            </div>
                            {h.optional && <Badge tone="accent" size="sm">Optional</Badge>}
                            {h.date === todayISO() && <Badge tone="brand" size="sm">Today</Badge>}
                            {canEdit && (
                              <Menu
                                label={`Actions for ${h.name}`}
                                trigger={
                                  <IconButton size="sm" label="More">
                                    <MoreHorizontal className="size-4" />
                                  </IconButton>
                                }
                                items={[
                                  { label: 'Edit', icon: <Pencil />, onSelect: () => setEdit(h) },
                                  {
                                    label: 'Delete',
                                    icon: <Trash2 />,
                                    danger: true,
                                    onSelect: async () =>
                                      (await confirm({ title: `Delete ${h.name}?`, body: `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} becomes a working day again.`, confirmLabel: 'Delete', tone: 'danger' })) && del.mutate(h),
                                  },
                                ]}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          )}
        </>
      )}
      {edit && calId && <HolidayDialog holiday={edit === 'new' ? null : edit} year={year} calendarId={calId} calendarName={many ? cal?.name : undefined} onClose={() => setEdit(null)} />}
      {importing && calId && <ImportDialog calendarId={calId} calendarName={many ? cal?.name : undefined} onClose={() => setImporting(false)} />}
      {calDialog && cv && <CalendarDialog row={calDialog === 'new' ? null : calDialog} view={cv} year={year} onClose={() => setCalDialog(null)} onCreated={(id) => ((created.current = id), setCalId(id))} />}
      {assign && cv && <AssignDialog cal={assign} view={cv} onClose={() => setAssign(null)} />}
    </div>
  )
}

/* ---------------- calendars (setup) ---------------- */
function CalendarCards({ view, selected, onSelect, canEdit, onNew, onEdit, onAssign }: { view: HolidayCalendarsView; selected: string | null; onSelect: (id: string) => void; canEdit: boolean; onNew: () => void; onEdit: (c: HolidayCalendarRow) => void; onAssign: (c: HolidayCalendarRow) => void }) {
  const { confirm } = useConfirm()
  const mkDefault = useMut((c: HolidayCalendarRow) => adminSetupApi.makeDefault(c.id), { success: (_, c) => `${c.name} is now the default calendar` })
  const toggle = useMut((c: HolidayCalendarRow) => adminSetupApi.updateCalendar(c.id, { active: !c.active }, c.version), { success: (_, c) => (c.active ? `${c.name} switched off` : `${c.name} switched on`) })
  const del = useMut((c: HolidayCalendarRow) => adminSetupApi.deleteCalendar(c.id, c.version), { success: (_, c) => `${c.name} deleted` })
  const unassigned = view.locations.length === 0
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">Calendars</h2>
          <p className="text-[12.5px] text-ink-3">
            {view.calendars.length} calendar{view.calendars.length === 1 ? '' : 's'} · locations without their own calendar use the default
          </p>
        </div>
        {canEdit && (
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={onNew}>
            New calendar
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {view.calendars.map((c) => (
          <div key={c.id} className={cn('flex min-w-0 flex-col rounded-lg border bg-surface', selected === c.id ? 'border-brand ring-1 ring-brand' : 'border-line', !c.active && 'opacity-70')}>
            <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 px-4 pb-2 pt-3 text-left" aria-pressed={selected === c.id}>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate text-[14px] font-semibold text-ink">{c.name}</span>
                {c.is_default && <Badge size="sm" tone="brand">Default</Badge>}
                {!c.active && <Badge size="sm" tone="danger">Off</Badge>}
                {c.id === view.my_calendar_id && <Badge size="sm">Yours</Badge>}
              </span>
              {c.description && <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{c.description}</span>}
              <span className="tnum mt-1.5 block text-[12.5px] text-ink-2">
                {c.holiday_count} holiday{c.holiday_count === 1 ? '' : 's'}
                {c.optional_count ? ` + ${c.optional_count} optional` : ''} in {view.year} · {c.people_count} {c.people_count === 1 ? 'person' : 'people'}
              </span>
              <span className="mt-1 flex min-w-0 items-start gap-1.5 text-[12.5px] text-ink-3">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{c.locations.length ? c.locations.map((l) => l.name).join(', ') : c.is_default && unassigned ? 'Everyone (no locations yet)' : 'No locations'}</span>
              </span>
            </button>
            {canEdit && (
              <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
                <Button size="xs" variant="ghost" icon={<MapPin className="size-3.5" />} onClick={() => onAssign(c)} disabled={!c.active || !view.locations.length}>
                  Locations
                </Button>
                <Button size="xs" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => onEdit(c)}>
                  Rename
                </Button>
                <span className="flex-1" />
                <Menu
                  label={`More for ${c.name}`}
                  trigger={
                    <IconButton size="sm" label="More">
                      <MoreHorizontal className="size-4" />
                    </IconButton>
                  }
                  items={[
                    { label: 'Make default', icon: <Pin />, disabled: c.is_default || !c.active, onSelect: () => mkDefault.mutate(c) },
                    { label: c.active ? 'Switch off' : 'Switch on', icon: <Check />, disabled: c.is_default, hint: c.is_default ? 'Default' : undefined, onSelect: () => toggle.mutate(c) },
                    { separator: true, label: '' },
                    {
                      label: 'Delete calendar',
                      icon: <Trash2 />,
                      danger: true,
                      disabled: c.is_default || c.is_base,
                      hint: c.is_base ? 'Company calendar' : c.is_default ? 'Default' : undefined,
                      onSelect: async () =>
                        (await confirm({ title: `Delete ${c.name}?`, body: `Its ${c.total_holidays} holiday${c.total_holidays === 1 ? '' : 's'} are deleted too. Locations must be moved to another calendar first.`, confirmLabel: 'Delete calendar', tone: 'danger' })) && del.mutate(c),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CalendarDialog({ row, view, year, onClose, onCreated }: { row: HolidayCalendarRow | null; view: HolidayCalendarsView; year: number; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: row?.name ?? '', description: row?.description ?? '', copy_from_id: '', copy_year: String(year) })
  const m = useMut(
    () =>
      row
        ? adminSetupApi.updateCalendar(row.id, { name: f.name.trim(), description: f.description.trim() }, row.version)
        : adminSetupApi.createCalendar({ name: f.name.trim(), description: f.description.trim(), copy_from_id: f.copy_from_id || null, copy_year: f.copy_from_id && f.copy_year ? Number(f.copy_year) : null }),
    {
      success: (r) => {
        const copied = (r as unknown as { copied?: number }).copied ?? 0
        return row ? 'Calendar saved' : `${f.name.trim()} created${copied ? ` with ${copied} holidays` : ''}`
      },
      onSuccess: (r) => {
        if (!row) onCreated((r as HolidayCalendarRow).id)
        onClose()
      },
      silentError: true,
    },
  )
  const e = m.error
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={row ? `Rename ${row.name}` : 'New holiday calendar'}
      description={row ? undefined : 'For a location with different public holidays, e.g. another state.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={m.isPending} disabled={f.name.trim().length < 2} onClick={() => m.mutate(undefined)}>
            {row ? 'Save' : 'Create calendar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {e && !e.field && <Callout tone="danger">{e.message}</Callout>}
        <Field label="Name" htmlFor="cal-name" required error={errField(e, 'name')}>
          <Input id="cal-name" autoFocus value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} placeholder="e.g. Maharashtra holidays" invalid={!!errField(e, 'name')} />
        </Field>
        <Field label="Description" htmlFor="cal-desc" error={errField(e, 'description')}>
          <Input id="cal-desc" value={f.description} onChange={(x) => setF({ ...f, description: x.target.value })} placeholder="Optional" />
        </Field>
        {!row && (
          <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
            <Field label="Copy holidays from" htmlFor="cal-copy" hint="Start from another calendar, then adjust.">
              <Select id="cal-copy" value={f.copy_from_id} onChange={(x) => setF({ ...f, copy_from_id: x.target.value })} options={[{ value: '', label: 'Start empty' }, ...view.calendars.map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
            {f.copy_from_id && (
              <Field label="Year" htmlFor="cal-year" error={errField(e, 'copy_year')}>
                <Select id="cal-year" value={f.copy_year} onChange={(x) => setF({ ...f, copy_year: x.target.value })} options={[{ value: '', label: 'All' }, ...[year - 1, year, year + 1].map(String)]} />
              </Field>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

function AssignDialog({ cal, view, onClose }: { cal: HolidayCalendarRow; view: HolidayCalendarsView; onClose: () => void }) {
  const [ids, setIds] = useState<string[]>(view.locations.filter((l) => l.calendar_id === cal.id && (l.explicit || !cal.is_default)).map((l) => l.id))
  const m = useMut(() => adminSetupApi.assignLocations(cal.id, ids), { success: 'Locations updated', onSuccess: onClose })
  const name = (id: string) => view.calendars.find((c) => c.id === id)?.name ?? '—'
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Locations on ${cal.name}`}
      description={cal.is_default ? 'Locations you don’t tick here still use this calendar while it is the default.' : 'Unticked locations go back to the default calendar.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate(undefined)}>
            Save locations
          </Button>
        </>
      }
    >
      <div className="divide-y divide-line rounded-lg border border-line">
        {view.locations.map((l) => (
          <div key={l.id} className="px-3.5 py-2.5">
            <Checkbox
              checked={ids.includes(l.id)}
              onChange={(v) => setIds((p) => (v ? [...p, l.id] : p.filter((x) => x !== l.id)))}
              label={`${l.name} (${l.code})`}
              description={l.calendar_id === cal.id ? (l.explicit ? 'Uses this calendar' : 'Uses this calendar as the default') : `Now on ${name(l.calendar_id)}`}
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
}

/* ---------------- year view ---------------- */
function YearCalendar({ year, cal, months }: { year: number; cal: CalendarCtx; months: { working_days: number }[] }) {
  const today = todayISO()
  const names = new Map((cal.holidays as Holiday[]).map((h) => [h.date, h]))
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((m, mi) => {
          const first = new Date(year, mi, 1)
          const lead = (first.getDay() + 6) % 7
          const days = new Date(year, mi + 1, 0).getDate()
          return (
            <div key={m} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">{m}</span>
                <span className="tnum text-[11.5px] text-ink-3">{months[mi].working_days} days</span>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WD.map((w, i) => (
                  <span key={i} className="text-[10px] font-semibold text-ink-3">
                    {w}
                  </span>
                ))}
                {Array.from({ length: lead }).map((_, i) => (
                  <span key={'l' + i} />
                ))}
                {Array.from({ length: days }).map((_, i) => {
                  const iso = `${year}-${String(mi + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                  const h = names.get(iso)
                  const kind = dayKind(iso, cal)
                  return (
                    <span
                      key={iso}
                      title={h ? `${h.name}${h.optional ? ' (optional)' : ''}` : kind === 'weekly_off' ? 'Weekly off' : undefined}
                      className={cn(
                        'tnum grid aspect-square place-items-center rounded-[6px] text-[11px] font-medium',
                        h && !h.optional && 'bg-danger-soft font-semibold text-danger-text',
                        h && h.optional && 'bg-surface-2 font-semibold text-ink ring-1 ring-inset ring-line-strong',
                        !h && kind === 'weekly_off' && 'bg-surface-2 text-ink-3',
                        iso === today && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
                      )}
                    >
                      {i + 1}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-danger-soft ring-1 ring-danger/30" /> Holiday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-surface-2 ring-1 ring-line-strong" /> Optional
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-surface-2 ring-1 ring-line" /> Weekly off
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] ring-2 ring-brand" /> Today
        </span>
      </div>
    </div>
  )
}

function HolidayDialog({ holiday, year, calendarId, calendarName, onClose }: { holiday: Holiday | null; year: number; calendarId: string; calendarName?: string; onClose: () => void }) {
  const [f, setF] = useState({ date: holiday?.date ?? (String(year) === todayISO().slice(0, 4) ? todayISO() : `${year}-01-01`), name: holiday?.name ?? '', optional: holiday?.optional ?? false })
  const m = useMut(() => (holiday ? adminSetupApi.updateHoliday(holiday.id, f, holiday.version) : adminSetupApi.addHoliday({ ...f, calendar_id: calendarId })), {
    success: holiday ? 'Holiday updated' : 'Holiday added',
    onSuccess: onClose,
    silentError: true,
  })
  const e = m.error
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={holiday ? 'Edit holiday' : 'Add holiday'}
      description={calendarName ? `Calendar: ${calendarName}` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate(undefined)}>
            {holiday ? 'Save' : 'Add holiday'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {e && !e.field && <Callout tone="danger">{e.message}</Callout>}
        <Field label="Date" htmlFor="h-date" required error={errField(e, 'date')}>
          <Input id="h-date" type="date" value={f.date} onChange={(ev) => setF({ ...f, date: ev.target.value })} invalid={!!errField(e, 'date')} />
        </Field>
        <Field label="Name" htmlFor="h-name" required error={errField(e, 'name')}>
          <Input id="h-name" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="e.g. Rath Yatra" invalid={!!errField(e, 'name')} autoFocus />
        </Field>
        <Checkbox checked={f.optional} onChange={(v) => setF({ ...f, optional: v })} label="Optional holiday" description="People may take it as leave; it does not reduce working days." />
      </div>
    </Dialog>
  )
}

function ImportDialog({ calendarId, calendarName, onClose }: { calendarId: string; calendarName?: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [preview, setPreview] = useState<{ rows: HolidayImportRow[]; valid: number; invalid: number } | null>(null)
  const parsed = useMemo(() => {
    const rows = parseCSV(text.trim())
    const body = rows.length && /date/i.test(rows[0][0] ?? '') ? rows.slice(1) : rows
    return body.map((r) => ({ date: (r[0] ?? '').trim(), name: (r[1] ?? '').trim(), optional: (r[2] ?? '').trim() }))
  }, [text])
  const pre = useMut(() => adminSetupApi.importHolidays(parsed, 'preview', calendarId), { onSuccess: (r) => setPreview(r) })
  const commit = useMut(() => adminSetupApi.importHolidays(parsed, 'commit', calendarId), { success: (r) => `${r.rows.length} holidays imported`, onSuccess: onClose })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={calendarName ? `Import holidays into ${calendarName}` : 'Import holidays'}
      description="Paste or upload a CSV with columns date, name and optionally optional (yes/no). Dates as YYYY-MM-DD or DD/MM/YYYY."
      footer={
        preview ? (
          <>
            <Button onClick={() => setPreview(null)}>Back</Button>
            <Button variant="primary" disabled={preview.invalid > 0} loading={commit.isPending} onClick={() => commit.mutate(undefined)}>
              Import {preview.valid} holiday{preview.valid === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              icon={<Download className="size-4" />}
              onClick={() => saveFile('holidays-template.csv', toCSV([['date', 'name', 'optional'], [`${todayISO().slice(0, 4)}-06-27`, 'Rath Yatra', 'no'], [`${todayISO().slice(0, 4)}-10-20`, 'Diwali', 'no']]), 'text/csv')}
            >
              Template
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!parsed.length} loading={pre.isPending} onClick={() => pre.mutate(undefined)}>
              Check {parsed.length || ''} row{parsed.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {!preview ? (
        <div className="space-y-4">
          <FileUpload
            accept=".csv,text/csv,text/plain"
            label="Drop a CSV or browse"
            hint="CSV · up to 1 MB"
            maxMb={1}
            file={file}
            onClear={() => {
              setFile(null)
              setText('')
            }}
            onFile={async (f) => {
              setFile({ name: f.name, size: f.size })
              setText(await readFileAsText(f))
            }}
          />
          <Field label="…or paste rows" htmlFor="csv">
            <Textarea id="csv" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'date,name,optional\n2026-10-02,Gandhi Jayanti,no\n2026-10-20,Diwali,no'} className="font-mono text-[13px]" />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          {preview.invalid > 0 ? (
            <Callout tone="danger" title={`${preview.invalid} row${preview.invalid === 1 ? '' : 's'} need fixing`}>
              Nothing is imported until every row is valid. Go back, fix the rows and check again.
            </Callout>
          ) : (
            <Callout tone="success" title="All rows look good">
              {preview.valid} holidays will be added.
            </Callout>
          )}
          <div className="overflow-x-auto rounded-lg border border-line scroll-thin">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-2 text-left text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className={cn('border-t border-line', r.errors.length && 'bg-danger-soft/50')}>
                    <td className="tnum px-3 py-2 text-ink-3">{r.line}</td>
                    <td className="tnum whitespace-nowrap px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">
                      {r.name}
                      {r.optional && (
                        <Badge tone="accent" size="sm" className="ml-1.5">
                          Optional
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.errors.length ? <span className="font-medium text-danger-text">{r.errors.join('; ')}</span> : <span className="text-success-text">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export function SetupHolidaysPage() {
  return <HolidaysPage variant="setup" />
}
