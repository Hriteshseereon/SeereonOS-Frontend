// Admin › Leave types & policies (v9, D10): every leave type of the company with its quota, accrual, carry-forward,
// encashment, who it applies to and when a supporting document is needed. The server validates and computes
// balances (backend/app/routes/admin_setup.py, app/engine/leave_types.py).
import { useMemo, useState } from 'react'
import { Palmtree, Plus, Trash2 } from '@/ui/icons'
import { useMut } from '@/api/query'
import { adminSetupApi, useLeaveTypes, type Accrual, type EmploymentType, type LeaveTypeInput, type LeaveTypeRow, type LeaveTypesView } from '@/api/adminSetup'
import { Badge, Button, Callout, DataTable, EmptyState, Field, Input, PageHeader, Segmented, Select, Sheet, Switch, Textarea, useConfirm, useReadOnly, useUnsavedChanges, type Column } from '@/ui'
import { cn } from '@/lib/utils'
import { errField } from '../admin/kit'

const fmtDays = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n} day${n === 1 ? '' : 's'}`)
const ACCRUAL_SHORT: Record<Accrual, string> = { monthly: 'Monthly', upfront: 'Upfront', annual: 'Annual' }

export function docRule(n: number | null) {
  return n === null ? 'Not needed' : n === 0 ? 'Always' : `Over ${n} day${n === 1 ? '' : 's'}`
}

function appliesTo(t: LeaveTypeRow, v: LeaveTypesView) {
  const parts: string[] = []
  if (t.applicable_role_keys.length) parts.push(t.applicable_role_keys.map((k) => v.roles.find((r) => r.key === k)?.name ?? k).join(', '))
  if (t.applicable_location_ids.length) parts.push(t.applicable_location_ids.map((k) => v.locations.find((r) => r.id === k)?.name ?? k).join(', '))
  if (t.applicable_employment_types.length) parts.push(t.applicable_employment_types.map((k) => v.employment_types.find((r) => r.value === k)?.label ?? k).join(', '))
  return parts.length ? parts.join(' · ') : 'Everyone'
}

function TypeBadges({ t }: { t: LeaveTypeRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {t.is_custom ? <Badge size="sm" tone="brand">Custom</Badge> : <Badge size="sm">Built-in</Badge>}
      {!t.configured && t.configurable && <Badge size="sm" tone="warning">Not set up</Badge>}
      {t.configured && !t.active && <Badge size="sm" tone="danger">Off</Badge>}
      {t.encashable && <Badge size="sm" tone="accent">Encashable</Badge>}
    </span>
  )
}

export default function LeaveTypesPage() {
  const q = useLeaveTypes()
  const readOnly = useReadOnly()
  const v = q.data
  const canEdit = !!v?.can_edit && !readOnly
  const [edit, setEdit] = useState<LeaveTypeRow | 'new' | null>(null)
  const active = v?.types.filter((t) => t.configured && t.active).length ?? 0

  const cols: Column<LeaveTypeRow>[] = [
    {
      key: 'name',
      header: 'Leave type',
      sortValue: (t) => t.name,
      cell: (t) => (
        <span className="block min-w-0 max-w-[260px]">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-ink">{t.name}</span>
            <TypeBadges t={t} />
          </span>
          {(t.description || !t.configurable) && <span className="block truncate text-[12.5px] text-ink-3">{t.description || 'Always available'}</span>}
        </span>
      ),
    },
    {
      key: 'quota',
      header: 'Quota a year',
      sortValue: (t) => t.annual_days ?? -1,
      cell: (t) => (
        <span className="block whitespace-nowrap">
          <span className="tnum">{t.configured ? fmtDays(t.annual_days) : t.configurable ? 'No limit' : '—'}</span>
          {t.accrual && <span className="block text-[12px] text-ink-3">{ACCRUAL_SHORT[t.accrual]}</span>}
        </span>
      ),
    },
    { key: 'carry', header: 'Carry fwd', align: 'right', cell: (t) => <span className="tnum whitespace-nowrap">{t.configured ? (t.carry_forward_max ? `≤ ${t.carry_forward_max}` : 'None') : '—'}</span>, hideBelow: 'xl' },
    { key: 'applies', header: 'Applies to', cell: (t) => <span className="block max-w-[180px] truncate text-ink-2" title={v ? appliesTo(t, v) : ''}>{v ? appliesTo(t, v) : ''}</span>, hideBelow: 'lg' },
    { key: 'doc', header: 'Document', cell: (t) => <span className="whitespace-nowrap text-ink-2">{t.configured ? docRule(t.attachment_after_days) : '—'}</span>, hideBelow: 'xl' },
    { key: 'used', header: 'Taken', align: 'right', sortValue: (t) => t.usage.days_fy, cell: (t) => <span className="tnum whitespace-nowrap">{t.usage.days_fy}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="Leave types & policies"
        subtitle="What people can apply for: the yearly quota, how it accrues, carry-forward, encashment, who each type applies to and when a supporting document is needed."
        actions={
          canEdit && (
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEdit('new')}>
              Add leave type
            </Button>
          )
        }
      />
      {v && v.types.every((t) => !t.configured) && (
        <Callout tone="warning" className="mb-4" title="No leave policy yet">
          Until you set up a type, people can apply for it without a quota. Set up at least casual and sick leave.
        </Callout>
      )}
      {v && (
        <div className="mb-4 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-4">
          {[
            ['Active types', String(active), `of ${v.types.filter((t) => t.configurable).length}`],
            ['People', String(v.people), 'active employees'],
            ['Custom types', String(v.types.filter((t) => t.is_custom).length), 'added by you'],
            ['Need a document', String(v.types.filter((t) => t.configured && t.attachment_after_days !== null).length), 'types'],
          ].map(([k, val, s], i) => (
            <div key={k} className={cn('min-w-0 px-3.5 py-3 md:px-4', i >= 2 && 'border-t border-line md:border-t-0')}>
              <div className="text-[12.5px] leading-tight text-ink-3">{k}</div>
              <div className="tnum mt-1.5 text-[18px] font-semibold leading-tight md:text-[20px]">{val}</div>
              <div className="mt-0.5 truncate text-[12px] text-ink-3">{s}</div>
            </div>
          ))}
        </div>
      )}
      <DataTable
        rows={v?.types}
        columns={cols}
        rowKey={(t) => t.code}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(t) => (t.configurable ? setEdit(t) : undefined)}
        rowLabel={(t) => `Open ${t.name}`}
        rowClassName={(t) => (t.configured && !t.active ? 'opacity-60' : undefined)}
        empty={<EmptyState compact icon={<Palmtree />} title="No leave types" />}
        mobileCard={(t) => (
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t.name}</span>
              <span className="tnum shrink-0 text-[13px]">{t.configured ? fmtDays(t.annual_days) : t.configurable ? 'No limit' : '—'}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TypeBadges t={t} />
              {t.accrual && <span className="text-[12px] text-ink-3">{ACCRUAL_SHORT[t.accrual]}</span>}
            </div>
            {v && t.configured && <p className="mt-1 truncate text-[12.5px] text-ink-3">{appliesTo(t, v)} · document {docRule(t.attachment_after_days).toLowerCase()}</p>}
          </div>
        )}
      />
      {edit && v && <LeaveTypeSheet view={v} row={edit === 'new' ? null : edit} canEdit={canEdit} onClose={() => setEdit(null)} />}
    </div>
  )
}

type DocMode = 'never' | 'always' | 'after'

function ChipToggle<T extends string>({ options, value, onChange, disabled, label }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; disabled?: boolean; label: string }) {
  if (!options.length) return <p className="text-[12.5px] text-ink-3">Nothing to choose yet.</p>
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cn(
              'inline-flex h-8 max-w-full items-center rounded-md border px-2.5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60',
              on ? 'border-brand bg-brand-soft font-medium text-brand-text' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3',
            )}
          >
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function LeaveTypeSheet({ view, row, canEdit, onClose }: { view: LeaveTypesView; row: LeaveTypeRow | null; canEdit: boolean; onClose: () => void }) {
  const { confirm } = useConfirm()
  const setupBuiltin = !!row && !row.configured
  const init = useMemo(
    () => ({
      name: row?.name ?? '',
      description: row?.description ?? '',
      annual_days: String(row?.annual_days ?? (row?.code === 'sick' ? 6 : 12)),
      accrual: (row?.accrual ?? 'monthly') as Accrual,
      carry_forward_max: String(row?.carry_forward_max ?? 0),
      encashable: row?.encashable ?? false,
      encash_max_days: row?.encash_max_days === null || row?.encash_max_days === undefined ? '' : String(row.encash_max_days),
      roles: row?.applicable_role_keys ?? [],
      locations: row?.applicable_location_ids ?? [],
      employment: (row?.applicable_employment_types ?? []) as EmploymentType[],
      doc: (row?.attachment_after_days === null || row?.attachment_after_days === undefined ? 'never' : row.attachment_after_days === 0 ? 'always' : 'after') as DocMode,
      doc_days: row?.attachment_after_days ? String(row.attachment_after_days) : '2',
      active: row?.active ?? true,
      sort_order: row?.sort_order === null || row?.sort_order === undefined ? '' : String(row.sort_order),
    }),
    [row],
  )
  const [f, setF] = useState(init)
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((p) => ({ ...p, [k]: val }))
  const body = (): LeaveTypeInput => ({
    ...(setupBuiltin && row ? { code: row.code } : {}),
    name: f.name.trim(),
    description: f.description.trim(),
    annual_days: Number(f.annual_days),
    accrual: f.accrual,
    carry_forward_max: Number(f.carry_forward_max || 0),
    encashable: f.encashable,
    encash_max_days: f.encashable && f.encash_max_days !== '' ? Number(f.encash_max_days) : null,
    applicable_role_keys: f.roles,
    applicable_location_ids: f.locations,
    applicable_employment_types: f.employment,
    attachment_after_days: f.doc === 'never' ? null : f.doc === 'always' ? 0 : Number(f.doc_days),
    active: f.active,
    sort_order: f.sort_order === '' ? null : Number(f.sort_order),
  })
  const dirty = JSON.stringify(f) !== JSON.stringify(init)
  const { confirmDiscard, release } = useUnsavedChanges(canEdit && dirty, { title: 'Discard changes to this leave type?', body: 'Your changes haven’t been saved.' })
  const done = () => {
    release()
    onClose()
  }
  const save = useMut(() => (row && row.configured ? adminSetupApi.updateLeaveType(row.code, body(), row.version) : adminSetupApi.createLeaveType(body())), {
    success: row?.configured ? `${f.name.trim()} saved` : `${f.name.trim()} set up`,
    onSuccess: done,
    silentError: true,
  })
  const del = useMut(() => adminSetupApi.deleteLeaveType(row!.code, row!.version), { success: `${row?.name} deleted`, onSuccess: done })
  const e = save.error
  const close = async () => (await confirmDiscard()) && onClose()
  const title = !row ? 'Add leave type' : setupBuiltin ? `Set up ${row.name} leave` : row.name

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && void close()}
      title={title}
      subtitle={row ? `${row.is_custom ? 'Custom' : 'Built-in'} type · code ${row.code}${row.configured ? ` · ${row.eligible_people} of ${view.people} people eligible` : ''}` : 'A new leave type people can apply for.'}
      width={620}
      footer={
        canEdit ? (
          <>
            {row?.configured && row.is_custom && (
              <Button
                variant="outline-danger"
                className="mr-auto"
                icon={<Trash2 className="size-4" />}
                disabled={row.in_use}
                title={row.in_use ? 'Applied for or recorded — switch it off instead' : undefined}
                loading={del.isPending}
                onClick={async () => (await confirm({ title: `Delete ${row.name}?`, body: 'Nobody has applied for it yet. This can’t be undone.', confirmLabel: 'Delete', tone: 'danger' })) && del.mutate(undefined)}
              >
                Delete
              </Button>
            )}
            <Button onClick={() => void close()}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
              {row?.configured ? 'Save' : setupBuiltin ? 'Set up' : 'Add leave type'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <fieldset disabled={!canEdit} className="space-y-5">
        {e && !e.field && <Callout tone="danger">{e.message}</Callout>}
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Name" htmlFor="lt-name" required error={errField(e, 'name') ?? errField(e, 'code')}>
            <Input id="lt-name" value={f.name} onChange={(x) => set('name', x.target.value)} placeholder="e.g. Maternity" invalid={!!errField(e, 'name')} autoFocus={!row} />
          </Field>
          <Field label="Order" htmlFor="lt-order" hint="In pickers" error={errField(e, 'sort_order')}>
            <Input id="lt-order" inputMode="numeric" value={f.sort_order} onChange={(x) => set('sort_order', x.target.value.replace(/[^0-9]/g, ''))} placeholder="Auto" />
          </Field>
        </div>
        <Field label="Description" htmlFor="lt-desc" hint="Shown to people when they apply." error={errField(e, 'description')}>
          <Textarea id="lt-desc" rows={2} value={f.description} onChange={(x) => set('description', x.target.value)} />
        </Field>

        <section className="space-y-4 rounded-lg border border-line p-4">
          <h3 className="text-[14px] font-semibold">Quota</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={row?.code === 'optional_holiday' ? 'Optional holidays a year' : 'Days a year'} htmlFor="lt-annual" required error={errField(e, 'annual_days')} hint="Half days allowed, 0–365.">
              <Input id="lt-annual" inputMode="decimal" value={f.annual_days} onChange={(x) => set('annual_days', x.target.value.replace(/[^0-9.]/g, ''))} invalid={!!errField(e, 'annual_days')} suffix="days" />
            </Field>
            <Field label="Carry forward up to" htmlFor="lt-carry" error={errField(e, 'carry_forward_max')} hint="Unused days moved to next FY (0 = none).">
              <Input id="lt-carry" inputMode="decimal" value={f.carry_forward_max} onChange={(x) => set('carry_forward_max', x.target.value.replace(/[^0-9.]/g, ''))} invalid={!!errField(e, 'carry_forward_max')} suffix="days" />
            </Field>
          </div>
          <Field label="How it accrues" error={errField(e, 'accrual')}>
            <Segmented block value={f.accrual} onChange={(x) => set('accrual', x)} options={view.accruals.map((a) => ({ value: a.value, label: ACCRUAL_SHORT[a.value] }))} />
            <p className="text-[12.5px] text-ink-3">{view.accruals.find((a) => a.value === f.accrual)?.label}</p>
          </Field>
          <div className="space-y-3">
            <Switch checked={f.encashable} onChange={(x) => set('encashable', x)} label="Encashable" description="Unused days can be paid out at the end of the financial year." />
            {f.encashable && (
              <Field label="Encash at most" htmlFor="lt-encash" error={errField(e, 'encash_max_days')} hint="Leave empty for no cap." className="sm:max-w-[260px]">
                <Input id="lt-encash" inputMode="decimal" value={f.encash_max_days} onChange={(x) => set('encash_max_days', x.target.value.replace(/[^0-9.]/g, ''))} suffix="days a year" />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-line p-4">
          <div>
            <h3 className="text-[14px] font-semibold">Applies to</h3>
            <p className="text-[12.5px] text-ink-3">Leave everything empty for everyone. A person must match every group you pick.</p>
          </div>
          <Field label="Roles" error={errField(e, 'applicable_role_keys')}>
            <ChipToggle label="Roles" options={view.roles.map((r) => ({ value: r.key, label: r.name }))} value={f.roles} onChange={(x) => set('roles', x)} disabled={!canEdit} />
          </Field>
          <Field label="Locations" error={errField(e, 'applicable_location_ids')}>
            <ChipToggle label="Locations" options={view.locations.map((r) => ({ value: r.id, label: r.name }))} value={f.locations} onChange={(x) => set('locations', x)} disabled={!canEdit} />
          </Field>
          <Field label="Employment types" error={errField(e, 'applicable_employment_types')}>
            <ChipToggle label="Employment types" options={view.employment_types} value={f.employment} onChange={(x) => set('employment', x)} disabled={!canEdit} />
          </Field>
        </section>

        <section className="space-y-3 rounded-lg border border-line p-4">
          <h3 className="text-[14px] font-semibold">Supporting document</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Required" htmlFor="lt-doc">
              <Select
                id="lt-doc"
                value={f.doc}
                onChange={(x) => set('doc', x.target.value as DocMode)}
                options={[
                  { value: 'never', label: 'Not needed' },
                  { value: 'always', label: 'For every request' },
                  { value: 'after', label: 'For longer requests' },
                ]}
              />
            </Field>
            {f.doc === 'after' && (
              <Field label="When a request is more than" htmlFor="lt-doc-days" error={errField(e, 'attachment_after_days')}>
                <Input id="lt-doc-days" inputMode="numeric" value={f.doc_days} onChange={(x) => set('doc_days', x.target.value.replace(/[^0-9]/g, ''))} invalid={!!errField(e, 'attachment_after_days')} suffix="days" />
              </Field>
            )}
          </div>
          <p className="text-[12.5px] text-ink-3">{f.doc === 'never' ? 'People may still attach a document when they apply.' : f.doc === 'always' ? 'Every request must carry a document (e.g. a certificate).' : `Requests of more than ${f.doc_days || 'N'} days must carry a document, e.g. a medical certificate.`}</p>
        </section>

        <div className="rounded-lg border border-line px-4 py-3">
          <Switch checked={f.active} onChange={(x) => set('active', x)} label="Offered" description="Switched off, the type is no longer offered; history and balances stay." />
        </div>
        {row?.configured && (
          <p className="tnum text-[12.5px] text-ink-3">
            {row.usage.requests} request{row.usage.requests === 1 ? '' : 's'} ({row.usage.pending} pending) · {row.usage.days_fy} days taken in {view.fy_label}
          </p>
        )}
      </fieldset>
    </Sheet>
  )
}
