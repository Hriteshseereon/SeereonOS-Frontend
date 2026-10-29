// /openings — hiring needs with a proper job description and a public apply link per opening (v9, decision D7).
// The link (/careers/<token>, built from the server's APP_URL) can be copied or shared on LinkedIn; applicants land in
// Recruitment as candidates with source "Careers link". A link stops taking applications when the opening is not open
// or interviewing, or when "Accept applications" is switched off (the server enforces both).
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, ExternalLink, Link2 as LinkIcon, MoreHorizontal, Pencil, Plus, RefreshCw, Share2 as Share, Trash2, UserPlus } from '@/ui/icons'
import type { Opening } from '@/types/entities'
import { projectsApi } from '@/api/projects'
import { ACCEPTING_STATUSES, EMPLOYMENT_TYPE, WORK_MODE, linkedInShareUrl, recruitingApi, type OpeningInput, type OpeningView } from '@/api/recruiting'
import { useApi, useMut } from '@/api/query'
import { ApiError } from '@/api/http'
import type { Tone } from '@/domain/labels'
import { diffDays, fmtDate, todayISO } from '@/domain/calendar'
import { useSession } from '@/stores/session'
import { usePermissionHolders } from '@/api/core'
import { cn } from '@/lib/utils'
import {
  Badge, Button, Callout, Checkbox, Combobox, DataTable, EmptyState, Field, FilterChips, IconButton, Input, Menu, MoneyInput, PageHeader, PeoplePicker, PersonName, Select, Sheet, StatusBadge, Switch, Textarea, toast, useConfirm, useReadOnly, type Column, type MenuItem,
} from '@/ui'

const STATUS: Record<Opening['status'], { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'info' },
  interviewing: { label: 'Interviewing', tone: 'accent' },
  offered: { label: 'Offered', tone: 'warning' },
  filled: { label: 'Filled', tone: 'success' },
  on_hold: { label: 'On hold', tone: 'neutral' },
}
const ORDER: Opening['status'][] = ['open', 'interviewing', 'offered', 'filled', 'on_hold']
type F = Opening['status'] | 'all' | 'active'

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    t.setAttribute('readonly', '')
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
  toast.success('Link copied', { description: 'Paste it in a job post, an email or a message.' })
}

/** the link's state as the server reports it (accepting_now), or what it would be once a link exists */
function linkState(o: OpeningView): { label: string; tone: Tone } {
  if (!o.public_url) return { label: 'No link', tone: 'neutral' }
  if (o.accepting_now) return { label: 'Accepting', tone: 'success' }
  return { label: 'Closed', tone: 'neutral' }
}

export default function OpeningsPage() {
  const readOnly = useReadOnly()
  const q = useApi(['openings'], recruitingApi.openings)
  const [f, setF] = useState<F>('active')
  const [edit, setEdit] = useState<OpeningView | 'new' | null>(null)
  const { confirm } = useConfirm()
  const setStatus = useMut((v: { o: OpeningView; s: Opening['status'] }) => recruitingApi.updateOpening(v.o.id, { status: v.s }, v.o.version), { invalidate: [['openings']], success: (_r, v) => `${v.o.role}: ${STATUS[v.s].label}` })
  const del = useMut((o: OpeningView) => recruitingApi.deleteOpening(o.id), { invalidate: [['openings']], success: 'Opening removed' })
  const makeLink = useMut((v: { o: OpeningView; regenerate: boolean }) => recruitingApi.publicLink(v.o.id, v.regenerate), {
    invalidate: [['openings']],
    success: (_r, v) => (v.regenerate ? 'New link created — the old one no longer works' : 'Public link created'),
    onSuccess: (r) => r.public_url && copyText(r.public_url),
  })
  const all = q.data ?? []
  const active = (o: OpeningView) => o.status !== 'filled' && o.status !== 'on_hold'
  const rows = all.filter((o) => f === 'all' || (f === 'active' ? active(o) : o.status === f))
  const count = (x: F) => (x === 'all' ? all.length : x === 'active' ? all.filter(active).length : all.filter((o) => o.status === x).length)
  const seats = all.filter(active).reduce((s, o) => s + o.count, 0)
  const live = all.filter((o) => o.accepting_now).length
  const today = todayISO()
  const current = edit && edit !== 'new' ? all.find((o) => o.id === edit.id) ?? edit : edit

  const askRegenerate = async (o: OpeningView) => {
    if (await confirm({ title: 'Create a new link?', body: 'The current link stops working at once — anyone who opens it sees “job not found”. Share the new link wherever the old one was posted.', confirmLabel: 'Create new link' })) makeLink.mutate({ o, regenerate: true })
  }
  const statusMenu = (o: OpeningView) => (
    <Menu
      label="Change status"
      align="start"
      trigger={
        <button type="button" disabled={readOnly} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 rounded-sm">
          <StatusBadge map={STATUS} value={o.status} size="sm" />
          {!readOnly && <ChevronDown className="size-3 text-ink-3" />}
        </button>
      }
      items={ORDER.filter((s) => s !== o.status).map((s) => ({ label: STATUS[s].label, onSelect: () => setStatus.mutate({ o, s }) }))}
    />
  )
  const menuItems = (o: OpeningView): MenuItem[] => [
    { label: 'Edit', icon: <Pencil />, onSelect: () => setEdit(o) },
    ...(o.public_url
      ? [
          { label: 'Copy link', icon: <Copy />, onSelect: () => copyText(o.public_url!) },
          { label: 'Share on LinkedIn', icon: <Share />, onSelect: () => window.open(linkedInShareUrl(o.public_url!), '_blank', 'noopener,noreferrer') },
          { label: 'Open job page', icon: <ExternalLink />, onSelect: () => window.open(o.public_url!, '_blank', 'noopener') },
          { label: 'New link', icon: <RefreshCw />, onSelect: () => askRegenerate(o) },
        ]
      : [{ label: 'Create public link', icon: <LinkIcon />, onSelect: () => makeLink.mutate({ o, regenerate: false }) }]),
    { separator: true, label: '' },
    { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: `Remove the ${o.role} opening?`, body: 'Use Filled or On hold instead if you want to keep the record. The public link stops working.', confirmLabel: 'Remove', tone: 'danger' })) && del.mutate(o) },
  ]
  const actions = (o: OpeningView) =>
    readOnly ? null : <Menu label={`Actions for ${o.role}`} trigger={<IconButton size="sm" label={`Actions for ${o.role}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal className="size-4" /></IconButton>} items={menuItems(o)} />
  const needed = (o: OpeningView) => {
    if (!o.needed_by) return <span className="text-ink-3">—</span>
    const late = active(o) && o.needed_by < today
    const soon = active(o) && !late && diffDays(o.needed_by, today) <= 14
    return <span className={cn('tnum whitespace-nowrap', late ? 'text-danger-text' : soon ? 'text-warning-text' : '')}>{fmtDate(o.needed_by)}{late ? ' · late' : ''}</span>
  }
  const sub = (o: OpeningView) => [o.location, o.work_mode ? WORK_MODE[o.work_mode] : null, o.employment_type ? EMPLOYMENT_TYPE[o.employment_type] : null].filter(Boolean).join(' · ')
  const linkCell = (o: OpeningView) => {
    const st = linkState(o)
    return (
      <div className="flex items-center gap-2">
        <Badge size="sm" tone={st.tone}>{st.label}</Badge>
        {o.public_url && <span className="tnum whitespace-nowrap text-[12.5px] text-ink-3">{o.applications ?? 0} applied</span>}
      </div>
    )
  }

  const columns: Column<OpeningView>[] = [
    { key: 'role', header: 'Role', sortValue: (r) => r.role, cell: (r) => <div className="min-w-0"><div className="font-medium">{r.role}</div>{(sub(r) || r.notes) && <div className="max-w-[320px] truncate text-[12px] text-ink-3">{sub(r) || r.notes}</div>}</div> },
    { key: 'project', header: 'Project', hideBelow: 'xl', sortValue: (r) => r.project_name ?? '', cell: (r) => (r.project_name ? <span className="text-[13px]"><span className="tnum text-ink-3">{r.project_code}</span> {r.project_name}</span> : <span className="text-ink-3">General</span>) },
    { key: 'count', header: 'Seats', align: 'right', sortValue: (r) => r.count, cell: (r) => <span className="tnum">{r.count}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => ORDER.indexOf(r.status), cell: (r) => <div onClick={(e) => e.stopPropagation()}>{statusMenu(r)}</div> },
    { key: 'link', header: 'Public link', sortValue: (r) => (r.accepting_now ? 2 : r.public_url ? 1 : 0), cell: linkCell },
    { key: 'owner', header: 'Owner', hideBelow: 'lg', cell: (r) => <PersonName id={r.owner_id} size={22} /> },
    { key: 'needed', header: 'Needed by', hideBelow: 'md', sortValue: (r) => r.needed_by ?? '9999', cell: needed },
    { key: 'menu', header: '', width: '44px', cell: (r) => <div onClick={(e) => e.stopPropagation()}>{actions(r)}</div> },
  ]
  return (
    <div>
      <PageHeader
        title="Openings"
        subtitle={q.data ? `${seats} seat${seats === 1 ? '' : 's'} to fill across ${count('active')} active opening${count('active') === 1 ? '' : 's'} · ${live} public link${live === 1 ? '' : 's'} taking applications` : 'Hiring needs, job descriptions and public apply links.'}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} disabled={readOnly} onClick={() => setEdit('new')} className="max-md:w-full">New opening</Button>}
      />
      <FilterChips
        className="mb-4"
        value={f}
        onChange={setF}
        options={[{ value: 'active' as F, label: 'Active', count: count('active') }, { value: 'all' as F, label: 'All', count: count('all') }, ...ORDER.map((s) => ({ value: s as F, label: STATUS[s].label, count: count(s) }))]}
      />
      <DataTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        rowKey={(r) => r.id}
        columns={columns}
        onRowClick={readOnly ? undefined : (r) => setEdit(r)}
        empty={<EmptyState icon={<UserPlus />} title={all.length ? 'No openings in this filter' : 'No openings yet'} body={all.length ? undefined : 'Write the job description once, then share its public link on LinkedIn — applicants land straight in Recruitment.'} action={!all.length && !readOnly ? <Button variant="primary" onClick={() => setEdit('new')}>New opening</Button> : undefined} />}
        mobileCard={(r) => (
          <div>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold">
                  {r.role} <span className="tnum text-ink-3">× {r.count}</span>
                </div>
                <div className="truncate text-[12.5px] text-ink-3">{sub(r) || (r.project_name ? `${r.project_code} ${r.project_name}` : 'General')}</div>
              </div>
              <div onClick={(e) => e.stopPropagation()} className="-mr-1.5 -mt-1 shrink-0">{actions(r)}</div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[12.5px]" onClick={(e) => e.stopPropagation()}>
              {statusMenu(r)}
              {linkCell(r)}
              <span className="text-ink-3">Needed by {needed(r)}</span>
            </div>
          </div>
        )}
      />
      {current && <OpeningSheet o={current === 'new' ? null : current} onClose={() => setEdit(null)} onRegenerate={askRegenerate} onCreateLink={(o) => makeLink.mutate({ o, regenerate: false })} linkBusy={makeLink.isPending} />}
    </div>
  )
}

type Form = Required<Omit<OpeningInput, 'publish_link'>> & { publish_link: boolean }

function OpeningSheet({ o, onClose, onRegenerate, onCreateLink, linkBusy }: { o: OpeningView | null; onClose: () => void; onRegenerate: (o: OpeningView) => void; onCreateLink: (o: OpeningView) => void; linkBusy: boolean }) {
  const { user } = useSession()
  const owners = usePermissionHolders('openings.manage')
  const projects = useApi(['projects', { status: 'all', q: '', type: '', sort: 'priority' }], () => projectsApi.list({ status: 'all' }))
  const init = (): Form => ({
    role: o?.role ?? '', project_id: o?.project_id ?? null, count: o?.count ?? 1, status: o?.status ?? 'open', owner_id: o?.owner_id ?? user?.id ?? '', needed_by: o?.needed_by ?? null, notes: o?.notes ?? '',
    about: o?.about ?? '', responsibilities: o?.responsibilities ?? '', requirements: o?.requirements ?? '', nice_to_have: o?.nice_to_have ?? '', location: o?.location ?? '', work_mode: o?.work_mode ?? null, employment_type: o?.employment_type ?? 'full_time',
    experience_min: o?.experience_min ?? null, experience_max: o?.experience_max ?? null, salary_min_paise: o?.salary_min_paise ?? null, salary_max_paise: o?.salary_max_paise ?? null, salary_visible: o?.salary_visible ?? false,
    accepting_applications: o?.accepting_applications ?? true, publish_link: true,
  })
  const [f, setF] = useState<Form>(init)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    setErrors({})
    setF(init())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.id])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    const pair: Record<string, string> = { experience_min: 'experience_max', experience_max: 'experience_min', salary_min_paise: 'salary_max_paise', salary_max_paise: 'salary_min_paise', salary_visible: 'salary_min_paise' }
    setErrors((e) => (e[k as string] || e[pair[k as string]] ? { ...e, [k as string]: '', ...(pair[k as string] ? { [pair[k as string]]: '' } : {}) } : e))
  }
  const onError = (e: ApiError) => e.field && setErrors((x) => ({ ...x, [e.field!]: e.message }))
  const body = (): Partial<OpeningInput> => {
    const { publish_link, ...rest } = f
    return o ? rest : { ...rest, publish_link }
  }
  const add = useMut(() => recruitingApi.addOpening(body()), {
    invalidate: [['openings']],
    success: (r) => (r.public_url ? 'Opening added — public link ready' : 'Opening added'),
    onSuccess: (r) => {
      if (r.public_url) void copyText(r.public_url)
      onClose()
    },
    onError,
  })
  const save = useMut(() => recruitingApi.updateOpening(o!.id, body(), o!.version), { invalidate: [['openings']], success: 'Opening saved', onSuccess: onClose, onError })
  const projOpts = useMemo(() => (projects.data?.items ?? []).filter((p) => !['closed', 'completed'].includes(p.status) || p.id === f.project_id).map((p) => ({ value: p.id, label: p.name, hint: `${p.code} · ${p.client}` })), [projects.data, f.project_id])
  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.role.trim()) e.role = 'Name the role.'
    if (!f.count || f.count < 1) e.count = 'At least 1.'
    if (!f.owner_id) e.owner_id = 'Choose an owner.'
    if (f.experience_min !== null && f.experience_max !== null && f.experience_min > f.experience_max) e.experience_min = 'Minimum can’t be more than the maximum.'
    if (f.salary_min_paise && f.salary_max_paise && f.salary_min_paise > f.salary_max_paise) e.salary_min_paise = 'The lower amount can’t be more than the upper one.'
    if (f.salary_visible && !f.salary_min_paise && !f.salary_max_paise) e.salary_min_paise = 'Enter a range to show it on the job page.'
    setErrors(e)
    if (Object.keys(e).length) return
    if (o) save.mutate(undefined)
    else add.mutate(undefined)
  }
  const num = (v: string) => (v === '' ? null : Number(v))
  const wouldAccept = ACCEPTING_STATUSES.includes(f.status) && f.accepting_applications
  return (
    <Sheet
      open
      onOpenChange={(v) => !v && onClose()}
      width={760}
      title={o ? `Edit ${o.role}` : 'New opening'}
      subtitle={o ? `Created ${fmtDate(o.created_at.slice(0, 10))}` : 'The job description is what applicants see on the public page.'}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={add.isPending || save.isPending} onClick={submit}>{o ? 'Save opening' : 'Add opening'}</Button>
        </div>
      }
    >
      <div className="space-y-7">
        <section aria-labelledby="op-basics" className="space-y-4">
          <h3 id="op-basics" className="text-[14px] font-semibold">Basics</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" required error={errors.role} className="sm:col-span-2" htmlFor="op-role">
              <Input id="op-role" value={f.role} invalid={!!errors.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. SAP CPI consultant" />
            </Field>
            <Field label="Project" hint="Leave empty for a general hire. Never shown on the public page." className="sm:col-span-2">
              <Combobox value={f.project_id} onChange={(v) => set('project_id', v)} options={projOpts} placeholder="General (no project)" searchPlaceholder="Search projects" clearable />
            </Field>
            <Field label="Seats" required error={errors.count} htmlFor="op-count">
              <Input id="op-count" type="number" min={1} max={50} value={f.count} invalid={!!errors.count} onChange={(e) => set('count', Number(e.target.value))} />
            </Field>
            <Field label="Status" htmlFor="op-status">
              <Select id="op-status" value={f.status} onChange={(e) => set('status', e.target.value as Opening['status'])} options={ORDER.map((s) => ({ value: s, label: STATUS[s].label }))} />
            </Field>
            <Field label="Owner" required error={errors.owner_id} hint="Gets a notification for every application.">
              <PeoplePicker value={f.owner_id || null} onChange={(v) => set('owner_id', v ?? '')} invalid={!!errors.owner_id} filter={(p) => (owners ? owners.has(p.id) : ['admin', 'pm', 'ops'].includes(p.role))} />
            </Field>
            <Field label="Needed by" error={errors.needed_by} htmlFor="op-needed">
              <Input id="op-needed" type="date" value={f.needed_by ?? ''} onChange={(e) => set('needed_by', e.target.value || null)} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="op-jd" className="space-y-4">
          <div>
            <h3 id="op-jd" className="text-[14px] font-semibold">Job description</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Write one point per line in the lists; they show as bullets on the job page.</p>
          </div>
          <Field label="About the role" error={errors.about} htmlFor="op-about">
            <Textarea id="op-about" rows={4} maxLength={4000} value={f.about} invalid={!!errors.about} onChange={(e) => set('about', e.target.value)} placeholder="What the person will own, the team, the kind of clients and projects." />
          </Field>
          <Field label="Responsibilities" error={errors.responsibilities} htmlFor="op-resp">
            <Textarea id="op-resp" rows={5} maxLength={4000} value={f.responsibilities} invalid={!!errors.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} placeholder={'Design and build integration flows\nReview code and mentor juniors'} />
          </Field>
          <Field label="Requirements" error={errors.requirements} htmlFor="op-req">
            <Textarea id="op-req" rows={5} maxLength={4000} value={f.requirements} invalid={!!errors.requirements} onChange={(e) => set('requirements', e.target.value)} placeholder={'3+ years of SAP ABAP\nHands-on SAP CPI'} />
          </Field>
          <Field label="Nice to have" error={errors.nice_to_have} htmlFor="op-nice">
            <Textarea id="op-nice" rows={3} maxLength={3000} value={f.nice_to_have} invalid={!!errors.nice_to_have} onChange={(e) => set('nice_to_have', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Location" error={errors.location} htmlFor="op-loc">
              <Input id="op-loc" value={f.location} invalid={!!errors.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Bhubaneswar" />
            </Field>
            <Field label="Work mode" error={errors.work_mode} htmlFor="op-mode">
              <Select id="op-mode" value={f.work_mode ?? ''} placeholder="Not specified" onChange={(e) => set('work_mode', (e.target.value || null) as Form['work_mode'])} options={Object.entries(WORK_MODE).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Employment type" error={errors.employment_type} htmlFor="op-type">
              <Select id="op-type" value={f.employment_type ?? ''} placeholder="Not specified" onChange={(e) => set('employment_type', (e.target.value || null) as Form['employment_type'])} options={Object.entries(EMPLOYMENT_TYPE).map(([value, label]) => ({ value, label }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Experience (years)" error={errors.experience_min || errors.experience_max} htmlFor="op-exmin">
              <div className="flex items-center gap-2">
                <Input id="op-exmin" aria-label="Minimum years" type="number" min={0} max={50} step={0.5} value={f.experience_min ?? ''} invalid={!!errors.experience_min} onChange={(e) => set('experience_min', num(e.target.value))} placeholder="Min" />
                <span className="text-ink-3">to</span>
                <Input aria-label="Maximum years" type="number" min={0} max={50} step={0.5} value={f.experience_max ?? ''} invalid={!!errors.experience_max} onChange={(e) => set('experience_max', num(e.target.value))} placeholder="Max" />
              </div>
            </Field>
            <Field label="Salary range (annual CTC)" error={errors.salary_min_paise || errors.salary_max_paise}>
              <div className="flex items-center gap-2">
                <MoneyInput aria-label="Lower salary" value={f.salary_min_paise} invalid={!!errors.salary_min_paise} onChange={(v) => set('salary_min_paise', v || null)} placeholder="From" />
                <span className="text-ink-3">to</span>
                <MoneyInput aria-label="Upper salary" value={f.salary_max_paise} invalid={!!errors.salary_max_paise} onChange={(v) => set('salary_max_paise', v || null)} placeholder="To" />
              </div>
            </Field>
          </div>
          <Switch checked={f.salary_visible} onChange={(v) => set('salary_visible', v)} label="Show the salary range on the job page" description="Off: the range stays internal." />
        </section>

        <section aria-labelledby="op-link" className="space-y-3">
          <h3 id="op-link" className="text-[14px] font-semibold">Public apply link</h3>
          {o ? (
            o.public_url ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={o.public_url} aria-label="Public link" className="min-w-0 flex-1 font-mono text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
                  <Button icon={<Copy className="size-4" />} onClick={() => copyText(o.public_url!)}>Copy link</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon={<Share className="size-4" />} onClick={() => window.open(linkedInShareUrl(o.public_url!), '_blank', 'noopener,noreferrer')}>Share on LinkedIn</Button>
                  <Button size="sm" icon={<ExternalLink className="size-4" />} onClick={() => window.open(o.public_url!, '_blank', 'noopener')}>Open job page</Button>
                  <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} loading={linkBusy} onClick={() => onRegenerate(o)}>New link</Button>
                </div>
                <p className="text-[12.5px] text-ink-3">{o.applications ?? 0} application{o.applications === 1 ? '' : 's'} through this link so far.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-[13px] text-ink-2">No public link yet. Create one to post this opening on LinkedIn or your website.</p>
                <Button size="sm" icon={<LinkIcon className="size-4" />} loading={linkBusy} onClick={() => onCreateLink(o)}>Create public link</Button>
              </div>
            )
          ) : (
            <Checkbox checked={f.publish_link} onChange={(v) => set('publish_link', v)} label="Create a public apply link" description="You can copy it or share it on LinkedIn right after saving." />
          )}
          <Switch checked={f.accepting_applications} onChange={(v) => set('accepting_applications', v)} label="Accept applications" description="Switch off to close the link without changing the opening’s status." />
          {!wouldAccept && (
            <Callout tone="neutral">
              {f.accepting_applications ? `While the opening is ${STATUS[f.status].label.toLowerCase()}, the link shows “no longer accepting applications” and refuses new ones.` : 'The link shows “no longer accepting applications” and refuses new ones.'}
            </Callout>
          )}
        </section>

        <section aria-labelledby="op-notes" className="space-y-3">
          <h3 id="op-notes" className="text-[14px] font-semibold">Internal notes</h3>
          <Textarea aria-labelledby="op-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Stage, budget, interview panel… (never shown publicly)" />
        </section>
      </div>
    </Sheet>
  )
}
