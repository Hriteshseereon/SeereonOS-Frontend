// Roles & permissions — list of roles, create / duplicate / delete, and a roles × permissions compare view.
import { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, Lock, MoreHorizontal, Plus, Trash2, UserCog, Users } from '@/ui/icons'
import { useMut } from '@/api/query'
import { accessApi, useRoles, type RoleRow } from '@/api/access'
import { usePermissionHolders, useRoleCompare } from '@/api/adminSetup'
import { isPending } from '@/api/changes'
import { MODULE_LABEL, MODULE_ORDER, PERMISSIONS, PERSONA_LABEL, type PermissionDef } from '@/domain/permissionCatalog'
import type { Role } from '@/types/entities'
import {
  Avatar, Badge, Button, Callout, DataTable, Dialog, EmptyState, ErrorState, Field, IconButton, Input, Menu, PageHeader, SearchInput, Select, SkeletonRows, Switch, Tabs, Textarea, useCan, useConfirm, useReadOnly, useUnsavedChanges, type Column,
} from '@/ui'
import { cn } from '@/lib/utils'
import { errField } from '../admin/kit'
import { announceNamed } from '../access/kit'

const PERSONAS: Role[] = ['admin', 'pm', 'sales', 'ops', 'employee']
export const PERSONA_OPTIONS = PERSONAS.map((p) => ({ value: p, label: PERSONA_LABEL[p] }))
const INV = [['roles'], ['changes'], ['setup-status']]

export function RoleTypeBadges({ r }: { r: RoleRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {r.is_system ? <Badge size="sm">Built-in</Badge> : <Badge tone="brand" size="sm">Custom</Badge>}
      {!r.active && <Badge tone="danger" size="sm">Inactive</Badge>}
      {r.pending && <Badge tone="warning" size="sm">Pending approval</Badge>}
    </span>
  )
}

export default function RolesPage() {
  const q = useRoles()
  const c = useCan()
  const readOnly = useReadOnly()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (['compare', 'holders'].includes(params.get('tab') ?? '') ? params.get('tab') : 'roles') as 'roles' | 'compare' | 'holders'
  const [creating, setCreating] = useState<string | null | false>(false)
  const { confirm } = useConfirm()
  const canManage = c('roles.manage') && !readOnly

  const clone = useMut((r: RoleRow) => accessApi.cloneRole(r.key), {
    invalidate: INV,
    onSuccess: (res) => {
      announceNamed(res, 'Role duplicated')
      if (!isPending(res)) nav(`/setup/roles/${res.result.key}`)
    },
  })
  const del = useMut((r: RoleRow) => accessApi.deleteRole(r.key), { invalidate: INV, onSuccess: (res) => announceNamed(res, 'Role deleted') })

  const roles = q.data ?? []
  const cols: Column<RoleRow>[] = [
    {
      key: 'name',
      header: 'Role',
      sortValue: (r) => r.name,
      cell: (r) => (
        <span className="block min-w-0 max-w-[420px]">
          <span className="block truncate font-medium text-ink">{r.name}</span>
          <span className="block truncate text-[12.5px] text-ink-3">{r.description || '—'}</span>
        </span>
      ),
    },
    { key: 'home', header: 'Home', sortValue: (r) => PERSONA_LABEL[r.persona], cell: (r) => <span className="whitespace-nowrap text-ink-2">{PERSONA_LABEL[r.persona]}</span>, hideBelow: 'xl' },
    { key: 'perms', header: 'Permissions', align: 'right', sortValue: (r) => r.permissions.length, cell: (r) => <span className="tnum">{r.permissions.length}</span> },
    { key: 'people', header: 'People', align: 'right', sortValue: (r) => r.user_count, cell: (r) => <span className="tnum">{r.user_count}</span> },
    { key: 'type', header: 'Type', cell: (r) => <RoleTypeBadges r={r} />, hideBelow: 'lg' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '52px',
      cell: (r) =>
        canManage ? (
          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
            <Menu
              label={`Actions for ${r.name}`}
              trigger={
                <IconButton size="sm" variant="ghost" label="More">
                  <MoreHorizontal className="size-4" />
                </IconButton>
              }
              items={[
                { label: 'Open', icon: <UserCog />, onSelect: () => nav(`/setup/roles/${r.key}`) },
                { label: 'Duplicate', icon: <Copy />, onSelect: () => clone.mutate(r) },
                ...(!r.is_system
                  ? [
                      { separator: true, label: '' },
                      {
                        label: 'Delete role',
                        icon: <Trash2 />,
                        danger: true,
                        disabled: r.user_count > 0,
                        hint: r.user_count > 0 ? 'In use' : undefined,
                        onSelect: async () => (await confirm({ title: `Delete ${r.name}?`, body: 'Nobody holds this role. Deleting it can’t be undone.', confirmLabel: 'Delete role', tone: 'danger' })) && del.mutate(r),
                      },
                    ]
                  : []),
              ]}
            />
          </span>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        subtitle="A role bundles what people can see and do. Give someone extra permissions on top of their role from People."
        actions={
          canManage && (
            <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCreating(null)}>
              New role
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          if (v !== 'roles') params.set('tab', v)
          else params.delete('tab')
          setParams(params, { replace: true })
        }}
        tabs={[
          { value: 'roles', label: 'Roles', count: roles.length },
          { value: 'compare', label: 'Compare roles' },
          { value: 'holders', label: 'Who has it' },
        ]}
      />
      {tab === 'roles' ? (
        <DataTable
          rows={roles}
          columns={cols}
          rowKey={(r) => r.key}
          loading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          onRowClick={(r) => nav(`/setup/roles/${r.key}`)}
          rowClassName={(r) => (!r.active ? 'opacity-60' : undefined)}
          empty={<EmptyState compact icon={<UserCog />} title="No roles yet" />}
          mobileCard={(r) => (
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-[14px] font-semibold">{r.name}</span>
                <span className="tnum shrink-0 text-[12.5px] text-ink-3">
                  {r.user_count} {r.user_count === 1 ? 'person' : 'people'}
                </span>
              </div>
              {r.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{r.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <RoleTypeBadges r={r} />
                <span className="text-[12px] text-ink-3">
                  {r.permissions.length} permissions · {PERSONA_LABEL[r.persona]}
                </span>
              </div>
            </div>
          )}
        />
      ) : tab === 'compare' ? (
        <CompareRoles roles={roles} loading={q.isLoading} initial={params.get('roles')?.split(',').filter(Boolean)} />
      ) : (
        <WhoHasIt initial={params.get('perm')} />
      )}
      {creating !== false && <NewRoleDialog roles={roles} copyFrom={creating} onClose={() => setCreating(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function NewRoleDialog({ roles, copyFrom, onClose }: { roles: RoleRow[]; copyFrom: string | null; onClose: () => void }) {
  const nav = useNavigate()
  const releaseRef = useRef<() => void>(() => {})
  const [f, setF] = useState({ name: '', description: '', persona: 'employee' as Role, copy_from: copyFrom ?? 'employee' })
  const src = roles.find((r) => r.key === f.copy_from)
  const m = useMut(
    () => accessApi.createRole({ name: f.name.trim(), description: f.description.trim(), persona: f.persona, permissions: src ? src.permissions : [], copy_from: f.copy_from || null }),
    {
      invalidate: INV,
      onSuccess: (res) => {
        announceNamed(res, `${f.name.trim()} created`)
        releaseRef.current()
        onClose()
        if (!isPending(res)) nav(`/setup/roles/${res.result.key}`)
      },
    },
  )
  const e = m.error
  // typed something: ask before throwing it away (Cancel, ✕, Esc, outside click, leaving the page)
  const { confirmDiscard, release } = useUnsavedChanges(!m.isSuccess && (f.name.trim() !== '' || f.description.trim() !== ''), { title: 'Discard this new role?', body: 'The role hasn’t been created yet. If you close now, what you typed is lost.' })
  releaseRef.current = release
  const close = async () => (await confirmDiscard()) && onClose()
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && void close()}
      title="New role"
      description="Start from an existing role and adjust its permissions next."
      footer={
        <>
          <Button onClick={() => void close()}>Cancel</Button>
          <Button variant="primary" loading={m.isPending} disabled={f.name.trim().length < 2} onClick={() => m.mutate(undefined)}>
            Create role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {e && !e.field && <Callout tone="danger">{e.message}</Callout>}
        <Field label="Name" htmlFor="r-name" required error={errField(e, 'name')}>
          <Input id="r-name" autoFocus value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="e.g. Finance Executive" invalid={!!errField(e, 'name')} />
        </Field>
        <Field label="Description" htmlFor="r-desc" hint="One line about who this role is for.">
          <Textarea id="r-desc" rows={2} value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start from" htmlFor="r-from" hint={src ? `${src.permissions.length} permissions copied` : 'No permissions — add them next'}>
            <Select
              id="r-from"
              value={f.copy_from}
              onChange={(ev) => {
                const r = roles.find((x) => x.key === ev.target.value)
                setF({ ...f, copy_from: ev.target.value, persona: r?.persona ?? f.persona })
              }}
              options={[{ value: '', label: 'Blank role' }, ...roles.filter((r) => r.active).map((r) => ({ value: r.key, label: r.name }))]}
            />
          </Field>
          <Field label="Home & default views" htmlFor="r-persona" error={errField(e, 'persona')}>
            <Select id="r-persona" value={f.persona} onChange={(ev) => setF({ ...f, persona: ev.target.value as Role })} options={PERSONA_OPTIONS} />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
function CompareRoles({ roles, loading, initial }: { roles: RoleRow[]; loading: boolean; initial?: string[] }) {
  const [q, setQ] = useState('')
  const [diffOnly, setDiffOnly] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  // v9: pick the roles to compare (none picked = every role); the server counts what they share and where they differ
  const [picked, setPicked] = useState<string[]>(initial ?? [])
  const cols = roles.filter((r) => (picked.length ? picked.includes(r.key) : showInactive || r.active))
  const cmp = useRoleCompare(picked.length >= 2 && picked.length <= 6 ? picked : [])
  const sets = useMemo(() => new Map(cols.map((r) => [r.key, new Set(r.permissions)])), [cols])
  const s = q.trim().toLowerCase()
  const groups = MODULE_ORDER.map((m) => ({
    m,
    perms: (PERMISSIONS as readonly PermissionDef[]).filter((p) => {
      if (p.module !== m) return false
      if (s && !`${p.label} ${p.key} ${p.description}`.toLowerCase().includes(s)) return false
      if (diffOnly) {
        const n = cols.filter((r) => sets.get(r.key)!.has(p.key)).length
        if (n === 0 || n === cols.length) return false
      }
      return true
    }),
  })).filter((g) => g.perms.length)
  if (loading) return <div className="skeleton h-64 rounded-lg" />
  return (
    <div className="min-w-0">
      <div className="mb-3">
        <div className="mb-1.5 text-[12.5px] text-ink-3">Compare {picked.length ? `${picked.length} role${picked.length === 1 ? '' : 's'}` : 'all roles'} — pick 2 to 6 to see what differs</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Roles to compare">
          {roles.map((r) => {
            const on = picked.includes(r.key)
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((k) => k !== r.key) : [...p, r.key]))}
                className={cn('inline-flex h-8 items-center rounded-md border px-2.5 text-[13px] transition', on ? 'border-brand bg-brand-soft font-medium text-brand-text' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3', !r.active && 'opacity-70')}
              >
                {r.name}
              </button>
            )
          })}
          {picked.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
              Clear
            </Button>
          )}
        </div>
        {picked.length > 6 && <p className="mt-1.5 text-[12.5px] text-warning-text">Pick at most 6 roles for the summary.</p>}
        {cmp.data && (
          <p className="tnum mt-2 text-[13px] text-ink-2">
            {cmp.data.summary.common} permission{cmp.data.summary.common === 1 ? '' : 's'} in common · {cmp.data.summary.differences} differ
            {cmp.data.roles.map((r) => (cmp.data!.summary.only[r.key] ? ` · only ${r.name}: ${cmp.data!.summary.only[r.key]}` : '')).join('')}
          </p>
        )}
      </div>
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search permissions" className="sm:w-[260px] sm:shrink-0" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <Switch checked={diffOnly} onChange={setDiffOnly} /> Only differences
          </label>
          {!picked.length && roles.some((r) => !r.active) && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <Switch checked={showInactive} onChange={setShowInactive} /> Inactive roles
            </label>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="max-h-[70vh] overflow-auto scroll-thin">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-[180px] max-w-[240px] border-b border-r border-line bg-surface-2 px-3 py-2 text-left text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3 sm:min-w-[260px]">Permission</th>
                {cols.map((r) => (
                  <th key={r.key} className="sticky top-0 z-10 w-[92px] min-w-[92px] border-b border-line bg-surface-2 px-2 py-2 text-center align-bottom text-[12px] font-medium leading-tight text-ink-2">
                    <span className="line-clamp-2 break-words">{r.name}</span>
                    <span className="tnum mt-0.5 block text-[11px] font-normal text-ink-3">{r.permissions.length}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.m}>
                  <tr>
                    <td className="sticky left-0 z-[5] border-b border-line bg-surface px-3 pb-1.5 pt-3 text-[12.5px] font-semibold text-ink">{MODULE_LABEL[g.m]}</td>
                    <td colSpan={cols.length} className="border-b border-line bg-surface" />
                  </tr>
                  {g.perms.map((p) => (
                    <tr key={p.key} className="group">
                      <td className="sticky left-0 z-[5] max-w-[240px] border-b border-r border-line bg-surface px-3 py-2 group-hover:bg-surface-2">
                        <span className="block truncate text-ink-2" title={p.description}>{p.label}</span>
                        <span className="hidden truncate text-[11.5px] text-ink-3 sm:block" title={p.description}>{p.description}</span>
                      </td>
                      {cols.map((r) => {
                        const on = sets.get(r.key)!.has(p.key)
                        return (
                          <td key={r.key} className={cn('border-b border-line px-2 py-2 text-center group-hover:bg-surface-2')}>
                            {on ? <Check className="mx-auto size-4 text-brand-text" aria-label="Yes" /> : <span className="text-ink-3/60" aria-label="No">–</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!groups.length && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-4 py-10 text-center text-ink-3">
                    {diffOnly ? 'These roles agree on every permission that matches.' : 'No permission matches your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/** v9: pick a permission → the roles that include it and every person who holds it (by role or as an extra grant). */
function WhoHasIt({ initial }: { initial?: string | null }) {
  const [q, setQ] = useState('')
  const [key, setKey] = useState<string | null>(initial ?? null)
  const h = usePermissionHolders(key)
  const c = useCan()
  const s = q.trim().toLowerCase()
  const groups = MODULE_ORDER.map((m) => ({ m, perms: (PERMISSIONS as readonly PermissionDef[]).filter((p) => p.module === m && (!s || `${p.label} ${p.key} ${p.description}`.toLowerCase().includes(s))) })).filter((g) => g.perms.length)
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="min-w-0">
        <SearchInput value={q} onChange={setQ} placeholder="Search permissions" className="mb-3" />
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-surface scroll-thin">
          {groups.map((g) => (
            <div key={g.m}>
              <div className="sticky top-0 z-[1] border-b border-line bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2">{MODULE_LABEL[g.m]}</div>
              <ul className="divide-y divide-line">
                {g.perms.map((p) => (
                  <li key={p.key}>
                    <button type="button" onClick={() => setKey(p.key)} aria-pressed={key === p.key} className={cn('flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition hover:bg-surface-2', key === p.key && 'bg-brand-soft')}>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13.5px] font-medium', key === p.key ? 'text-brand-text' : 'text-ink')}>{p.label}</span>
                        <span className="block truncate text-[12px] text-ink-3">{p.description}</span>
                      </span>
                      {p.sensitive && <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-label="Sensitive" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!groups.length && <p className="px-4 py-8 text-center text-[13px] text-ink-3">No permission matches your search.</p>}
        </div>
      </div>
      <div className="min-w-0">
        {!key ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState compact icon={<Users />} title="Pick a permission" body="See which roles include it and everyone who can use it — through their role or as an extra grant." />
          </div>
        ) : h.isLoading ? (
          <SkeletonRows rows={5} />
        ) : h.error || !h.data ? (
          <ErrorState error={h.error} onRetry={() => h.refetch()} />
        ) : (
          <div className="space-y-4">
            <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold">{h.data.permission.label}</h2>
                <Badge size="sm">{h.data.permission.module_label}</Badge>
                {h.data.permission.sensitive && <Badge size="sm" tone="warning">Sensitive</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{h.data.permission.description}</p>
              <p className="mt-1 font-mono text-[12px] text-ink-3">{h.data.permission.key}</p>
              {(h.data.permission.requires?.length || h.data.permission.required_by.length) ? (
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  {h.data.permission.requires?.length ? `Needs ${h.data.permission.requires.map(permLabelOf).join(', ')}. ` : ''}
                  {h.data.permission.required_by.length ? `Needed by ${h.data.permission.required_by.map(permLabelOf).join(', ')}.` : ''}
                </p>
              ) : null}
            </section>
            <section>
              <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">Roles that include it · {h.data.roles.length}</h3>
              {h.data.roles.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {h.data.roles.map((r) => (
                    <Link key={r.key} to={`/setup/roles/${r.key}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">
                      {r.name}
                      <span className="tnum text-[12px] text-ink-3">{r.user_count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-1 text-[13px] text-ink-3">No role includes it.</p>
              )}
            </section>
            <section>
              <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">People who hold it · {h.data.total}</h3>
              {h.data.people.length ? (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {h.data.people.map((u) => {
                    const inner = (
                      <>
                        <Avatar name={u.name} hue={u.avatar_hue} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink">{u.name}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">{[u.title, u.role_name].filter(Boolean).join(' · ') || u.email}</span>
                        </span>
                        <Badge size="sm" tone={u.via === 'extra' ? 'accent' : 'neutral'}>
                          {u.via === 'extra' ? 'Extra grant' : 'Via role'}
                        </Badge>
                      </>
                    )
                    return (
                      <li key={u.id}>
                        {c('users.view') ? (
                          <Link to={`/people?focus=${u.id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-2">
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-2.5">{inner}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="px-1 text-[13px] text-ink-3">Nobody holds it.</p>
              )}
            </section>
            {h.data.revoked.length > 0 && (
              <section>
                <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">Removed for · {h.data.revoked.length}</h3>
                <p className="mb-1.5 px-1 text-[12.5px] text-ink-3">Their role includes it, but it was taken away from them personally.</p>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {h.data.revoked.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar name={u.name} hue={u.avatar_hue} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{u.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{u.role_name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const permLabelOf = (k: string) => (PERMISSIONS as readonly PermissionDef[]).find((p) => p.key === k)?.label ?? k
