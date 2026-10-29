// /setup/teams — Admin › Organisation setup › Teams (v9, decision D6): the teams master (name, description, lead,
// optional department, members). People › Team groups people by these teams; with none it falls back to departments.
// master.view lists, master.edit changes (enforced by the server).
import { useMemo, useState } from 'react'
import { Ban, Pencil, Plus, RotateCcw, Trash2, Users, X } from '@/ui/icons'
import { teamsApi, type TeamInput, type TeamView } from '@/api/recruiting'
import { useMasterList } from '@/api/master'
import { usePeopleMap } from '@/api/core'
import type { ApiError } from '@/api/http'
import { useApi, useMut } from '@/api/query'
import { Avatar, Button, DataTable, EmptyState, Field, Input, PageHeader, PeoplePicker, PersonName, Select, Textarea, useCan, useConfirm, useReadOnly, type Column, type MenuItem } from '@/ui'
import { InactiveBadge, ListToolbar, RecordDialog, RowMenu, errOf } from '@/modules/setup/master/kit'

export default function TeamsSetupPage() {
  const q = useApi(['teams'], teamsApi.list)
  const c = useCan()
  const ro = useReadOnly()
  const canEdit = !ro && c('master.edit')
  const { confirm } = useConfirm()
  const [edit, setEdit] = useState<TeamView | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const setActive = useMut((v: { t: TeamView; active: boolean }) => teamsApi.update(v.t.id, { active: v.active }, v.t.version), { invalidate: [['teams']], success: (_r, v) => `${v.t.name} ${v.active ? 'activated' : 'deactivated'}` })
  const del = useMut((t: TeamView) => teamsApi.remove(t.id, t.version), { invalidate: [['teams']], success: (_r, t) => `${t.name} deleted` })
  const all = q.data ?? []
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return all.filter((t) => (showInactive || t.active) && (!s || `${t.name} ${t.description} ${t.lead_name ?? ''} ${t.department_name ?? ''}`.toLowerCase().includes(s)))
  }, [all, search, showInactive])
  const menu = (t: TeamView): MenuItem[] => [
    { label: 'Edit', icon: <Pencil />, onSelect: () => setEdit(t) },
    t.active
      ? { label: 'Deactivate', icon: <Ban />, onSelect: async () => (await confirm({ title: `Deactivate ${t.name}?`, body: 'It disappears from People › Team and Team documents. You can activate it again any time.', confirmLabel: 'Deactivate' })) && setActive.mutate({ t, active: false }) }
      : { label: 'Activate', icon: <RotateCcw />, onSelect: () => setActive.mutate({ t, active: true }) },
    { separator: true, label: '' },
    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: `Delete ${t.name}?`, body: 'The team is removed for good. People stay in the company; only the grouping goes.', confirmLabel: 'Delete', tone: 'danger' })) && del.mutate(t) },
  ]
  const cols: Column<TeamView>[] = [
    {
      key: 'name', header: 'Team', sortValue: (t) => t.name.toLowerCase(),
      cell: (t) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{t.name}</span>
            {!t.active && <InactiveBadge />}
          </div>
          <div className="max-w-[360px] truncate text-[12.5px] text-ink-3">{t.description || t.department_name || '—'}</div>
        </div>
      ),
    },
    { key: 'lead', header: 'Lead', cell: (t) => (t.lead_id ? <PersonName id={t.lead_id} size={24} /> : <span className="text-ink-3">No lead</span>) },
    { key: 'dep', header: 'Department', hideBelow: 'lg', sortValue: (t) => t.department_name ?? '', cell: (t) => <span className="text-ink-2">{t.department_name ?? '—'}</span> },
    { key: 'members', header: 'Members', align: 'right', sortValue: (t) => t.active_member_count, cell: (t) => <span className="tnum whitespace-nowrap text-[13px] text-ink-2">{t.active_member_count === 1 ? '1 person' : `${t.active_member_count} people`}</span> },
    ...(canEdit ? [{ key: '_m', header: <span className="sr-only">Actions</span>, width: '52px', align: 'right' as const, cell: (t: TeamView) => <RowMenu label={`Actions for ${t.name}`} items={menu(t)} /> }] : []),
  ]
  const inactive = all.filter((t) => !t.active).length
  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Working groups with a lead and members. People › Team and Documents › Team documents group people by these teams."
        actions={canEdit && <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEdit('new')}>Add team</Button>}
      />
      {all.length > 0 && <ListToolbar search={search} onSearch={setSearch} showInactive={showInactive} onShowInactive={setShowInactive} inactiveCount={inactive} placeholder="Search teams" />}
      <DataTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        rowKey={(t) => t.id}
        columns={cols}
        onRowClick={canEdit ? (t) => setEdit(t) : undefined}
        rowClassName={(t) => (t.active ? undefined : 'bg-surface-2/50')}
        mobileCard={(t) => (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[14px] font-medium">{t.name}</span>
                {!t.active && <InactiveBadge />}
              </div>
              <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{t.description || t.department_name || 'No description'}</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                {t.lead_id ? <PersonName id={t.lead_id} size={22} className="text-[13px]" /> : <span className="text-[13px] text-ink-3">No lead</span>}
                <span className="tnum text-[13px] text-ink-2">{t.active_member_count} people</span>
              </div>
            </div>
            {canEdit && <RowMenu label={`Actions for ${t.name}`} items={menu(t)} />}
          </div>
        )}
        empty={
          <EmptyState
            icon={<Users />}
            title={all.length ? 'No teams match' : 'No teams yet'}
            body={all.length ? 'Try a different search, or turn on “Show inactive”.' : 'Until you add teams, People › Team groups people by department.'}
            action={!all.length && canEdit ? <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>Add team</Button> : undefined}
          />
        }
      />
      {edit && <TeamDialog row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TeamDialog({ row, onClose }: { row: TeamView | null; onClose: () => void }) {
  const deps = useMasterList('departments')
  const people = usePeopleMap()
  const byId = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p])), [people.data])
  const [f, setF] = useState<TeamInput>({ name: row?.name ?? '', description: row?.description ?? '', lead_id: row?.lead_id ?? null, department_id: row?.department_id ?? null, member_ids: row?.member_ids ?? [] })
  const [adding, setAdding] = useState<string | null>(null)
  const m = useMut(() => (row ? teamsApi.update(row.id, f, row.version) : teamsApi.create(f)), { invalidate: [['teams']], success: row ? 'Team saved' : 'Team added', onSuccess: onClose })
  const e = m.error as ApiError | null
  const set = <K extends keyof TeamInput>(k: K, v: TeamInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const depOpts = (deps.data ?? []).filter((d) => d.active || d.id === f.department_id).map((d) => ({ value: d.id, label: d.name }))
  const addMember = (id: string | null) => {
    if (id && !f.member_ids.includes(id)) set('member_ids', [...f.member_ids, id])
    setAdding(null)
  }
  const members = f.lead_id && !f.member_ids.includes(f.lead_id) ? [f.lead_id, ...f.member_ids] : f.member_ids
  return (
    <RecordDialog title={row ? `Edit ${row.name}` : 'Add team'} onClose={onClose} onSave={() => m.mutate(undefined)} saving={m.isPending} saveLabel={row ? 'Save' : 'Add team'} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="team-name" required error={errOf(e, 'name')}>
          <Input id="team-name" value={f.name} onChange={(x) => set('name', x.target.value)} placeholder="e.g. SAP delivery" maxLength={80} invalid={!!errOf(e, 'name')} />
        </Field>
        <Field label="Department" htmlFor="team-dep" hint="Optional" error={errOf(e, 'department_id')}>
          <Select id="team-dep" value={f.department_id ?? ''} onChange={(x) => set('department_id', x.target.value || null)} placeholder="No department" options={depOpts} />
        </Field>
      </div>
      <Field label="Description" htmlFor="team-desc" error={errOf(e, 'description')}>
        <Textarea id="team-desc" rows={2} maxLength={500} value={f.description} onChange={(x) => set('description', x.target.value)} placeholder="What the team works on" />
      </Field>
      <Field label="Lead" error={errOf(e, 'lead_id')} hint="The lead sees the team’s timesheets on People › Team.">
        <PeoplePicker value={f.lead_id} onChange={(v) => set('lead_id', v)} clearable placeholder="Choose the team lead" invalid={!!errOf(e, 'lead_id')} />
      </Field>
      <Field label={`Members (${members.length})`} error={errOf(e, 'member_ids')}>
        <div className="space-y-2">
          <PeoplePicker value={adding} onChange={addMember} placeholder="Add a member" filter={(p) => !members.includes(p.id)} />
          {members.length ? (
            <ul className="divide-y divide-line rounded-md border border-line">
              {members.map((id) => {
                const p = byId.get(id)
                const isLead = id === f.lead_id
                return (
                  <li key={id} className="flex items-center gap-2.5 px-3 py-2">
                    <Avatar name={p?.name ?? '—'} hue={p?.avatar_hue ?? 0} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{p?.name ?? 'Unknown person'}</div>
                      <div className="truncate text-[12px] text-ink-3">{isLead ? 'Lead' : p?.title ?? ''}{p && p.status !== 'active' ? ' · inactive' : ''}</div>
                    </div>
                    {!isLead && (
                      <button type="button" onClick={() => set('member_ids', f.member_ids.filter((x) => x !== id))} className="grid size-9 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Remove ${p?.name ?? 'member'}`}>
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-3">No members yet.</p>
          )}
        </div>
      </Field>
    </RecordDialog>
  )
}
