// /team — People › Team (v9, decision D6): the whole team as a unit. Team cards (lead, members, totals) → the members
// of a team with their info (title, contact, manager, location, joined) and this week's timesheet status and hours vs
// target → a person's week day by day. Grouped by the Teams master; with no teams, by department. The week follows the
// header week switcher. The server scopes what each viewer sees (people.view_all: everyone; team.view: their teams).
// The 8-week timesheet grid (Feature Guide G9.04) is at /team/timesheets.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Mail, MapPin, Phone, SlidersHorizontal, UserCog, Users } from '@/ui/icons'
import { useApi } from '@/api/query'
import { teamsApi, type TeamGroup, type TeamMember, type WeekFacts, type WeekStatus } from '@/api/recruiting'
import { fmtDate, todayISO, weekLabel, weekStart } from '@/domain/calendar'
import { fmtHours } from '@/domain/money'
import type { Tone } from '@/domain/labels'
import { useWeek } from '@/stores/ui'
import { cn } from '@/lib/utils'
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  KV,
  PageHeader,
  Progress,
  SearchInput,
  Sheet,
  SkeletonCards,
  SkeletonRows,
  StatCard,
  StatusBadge,
  useCan,
  type Column,
} from '@/ui'

export const WEEK_STATUS: Record<WeekStatus, { label: string; tone: Tone }> = {
  approved: { label: 'Approved', tone: 'success' },
  submitted: { label: 'Submitted', tone: 'warning' },
  open: { label: 'Draft', tone: 'info' },
  not_started: { label: 'Not started', tone: 'neutral' },
  not_due: { label: 'Nothing due', tone: 'neutral' },
  missing: { label: 'Missing', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'danger' },
  locked: { label: 'Locked', tone: 'danger' },
}
function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [d, setD] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}
const pctTone = (h: number, t: number): Tone => (t <= 0 ? 'neutral' : h >= t ? 'success' : h >= t * 0.8 ? 'warning' : 'danger')

export default function TeamOverviewPage() {
  const c = useCan()
  const headerWeek = useWeek()
  const thisWeek = weekStart(todayISO())
  const week = headerWeek > thisWeek ? thisWeek : headerWeek
  const q = useApi(['teams', 'overview', week], () => teamsApi.overview(week))
  const d = q.data
  const [sel, setSel] = useState<string | null>(null)
  const [person, setPerson] = useState<TeamMember | null>(null)
  const [search, setSearch] = useState('')
  const desktop = useIsDesktop()
  useEffect(() => {
    if (d && sel && !d.groups.some((g) => g.id === sel)) setSel(null)
  }, [d, sel])
  const selected = d?.groups.find((g) => g.id === sel) ?? null
  const desktopSel = selected ?? d?.groups[0] ?? null
  const isCurrent = week === thisWeek
  const groups = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (d?.groups ?? []).filter((g) => !s || g.name.toLowerCase().includes(s) || g.members.some((m) => m.name.toLowerCase().includes(s)))
  }, [d, search])

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`Who is in each team, their details and their timesheet for ${isCurrent ? 'this week' : `the week of ${weekLabel(week)}`}.`}
        actions={
          <div className="flex flex-wrap gap-2 max-md:w-full">
            {c('team.view') && (
              <Link
                to="/team/timesheets"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13.5px] font-medium hover:bg-surface-2 max-md:flex-1 max-md:justify-center"
              >
                <CalendarClock className="size-4" />
                Timesheet grid
              </Link>
            )}
            {d?.can_manage && (
              <Link
                to="/setup/teams"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13.5px] font-medium hover:bg-surface-2 max-md:flex-1 max-md:justify-center"
              >
                <SlidersHorizontal className="size-4" />
                Manage teams
              </Link>
            )}
          </div>
        }
      />
      {q.isLoading ? (
        <div className="space-y-4">
          <SkeletonCards n={4} />
          <SkeletonRows rows={6} />
        </div>
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d.groups.length ? (
        <Card pad={false}>
          <EmptyState
            icon={<Users />}
            title="No team to show yet"
            body={d.can_manage ? 'Create teams and add people to them, or add people to departments.' : 'You are not in a team and nobody reports to you.'}
            action={
              d.can_manage ? (
                <Link to="/setup/teams" className="text-[13px] font-medium text-brand-text hover:underline">
                  Create a team
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-5">
          {d.mode === 'departments' && (
            <Callout tone="info" title="Grouped by department">
              No teams have been set up yet, so people are grouped by their department.
              {d.can_manage && (
                <>
                  {' '}
                  <Link to="/setup/teams" className="font-medium text-brand-text hover:underline">
                    Create teams
                  </Link>{' '}
                  to group them your way.
                </>
              )}
            </Callout>
          )}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
            <StatCard label={d.mode === 'teams' ? 'Teams' : 'Departments'} value={d.totals.groups} sub={`${d.totals.people} people`} />
            <StatCard
              label="Hours logged"
              value={<span className="tnum">{fmtHours(d.totals.hours)}</span>}
              sub={`target to date ${fmtHours(d.totals.target_to_date)}`}
              tone={pctTone(d.totals.hours, d.totals.target_to_date) === 'danger' ? 'danger' : undefined}
            />
            <StatCard label="Awaiting approval" value={d.totals.awaiting_approval} sub="submitted weeks" tone={d.totals.awaiting_approval ? 'warning' : undefined} />
            <StatCard label="Missing or rejected" value={d.totals.missing} sub={isCurrent ? 'week not closed yet' : 'weeks to fix'} tone={d.totals.missing ? 'danger' : undefined} />
            <StatCard label="Short days" value={d.totals.short_people} sub="people below the daily minimum" tone={d.totals.short_people ? 'warning' : undefined} />
            <StatCard label="Daily minimum" value={<span className="tnum">{fmtHours(d.min_hours_per_day)}</span>} sub="per working day" />
          </div>

          {/* phone / tablet: cards, then one team at a time */}
          {!desktop && (
            <div>
              {selected ? (
                <div>
                  <button type="button" onClick={() => setSel(null)} className="-ml-1 mb-3 inline-flex h-10 items-center gap-1 text-[14px] font-medium text-brand-text">
                    <ArrowLeft className="size-4" />
                    All {d.mode === 'teams' ? 'teams' : 'departments'}
                  </button>
                  <GroupDetail g={selected} onPerson={setPerson} />
                </div>
              ) : (
                <>
                  <SearchInput value={search} onChange={setSearch} placeholder="Search teams or people" className="mb-3" />
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {groups.map((g) => (
                      <GroupCard key={g.id} g={g} onOpen={() => setSel(g.id)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* desktop: master–detail */}
          {desktop && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-4 min-w-0 space-y-2.5 2xl:col-span-3">
                <SearchInput value={search} onChange={setSearch} placeholder="Search teams or people" />
                {groups.map((g) => (
                  <GroupCard key={g.id} g={g} active={desktopSel?.id === g.id} onOpen={() => setSel(g.id)} />
                ))}
                {!groups.length && <p className="px-1 py-6 text-center text-[13px] text-ink-3">Nothing matches “{search}”.</p>}
              </div>
              <div className="col-span-8 min-w-0 2xl:col-span-9">{desktopSel && <GroupDetail g={desktopSel} onPerson={setPerson} />}</div>
            </div>
          )}
        </div>
      )}
      {person && <PersonSheet m={person} onClose={() => setPerson(null)} />}
    </div>
  )
}

function GroupCard({ g, active, onOpen }: { g: TeamGroup; active?: boolean; onOpen: () => void }) {
  const t = g.totals
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active || undefined}
      className={cn('block w-full min-w-0 rounded-lg border bg-surface p-4 text-left transition hover:bg-surface-2/60', active ? 'border-brand ring-1 ring-brand' : 'border-line')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold">{g.name}</div>
          <div className="truncate text-[12.5px] text-ink-3">
            {g.lead_name ? `${g.kind === 'department' ? 'Head' : 'Lead'}: ${g.lead_name}` : g.kind === 'unassigned' ? g.description || 'Not grouped' : 'No lead'}
            {g.department_name ? ` · ${g.department_name}` : ''}
          </div>
        </div>
        <span className="tnum shrink-0 text-[12.5px] text-ink-3">
          {t.members} {t.members === 1 ? 'person' : 'people'}
        </span>
      </div>
      {t.visible > 0 ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="text-ink-3">Hours vs target to date</span>
            <span className="tnum whitespace-nowrap font-medium">
              {fmtHours(t.hours)} / {fmtHours(t.target_to_date)}
            </span>
          </div>
          <Progress className="mt-1.5" value={t.hours} max={Math.max(t.target_to_date, 1)} tone={pctTone(t.hours, t.target_to_date)} />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {t.approved > 0 && (
              <Badge size="sm" tone="success">
                {t.approved} approved
              </Badge>
            )}
            {t.submitted > 0 && (
              <Badge size="sm" tone="warning">
                {t.submitted} submitted
              </Badge>
            )}
            {t.draft > 0 && (
              <Badge size="sm" tone="info">
                {t.draft} draft
              </Badge>
            )}
            {(t.not_started ?? 0) > 0 && (
              <Badge size="sm" tone="neutral">
                {t.not_started} not started
              </Badge>
            )}
            {t.missing > 0 && (
              <Badge size="sm" tone="danger">
                {t.missing} missing
              </Badge>
            )}
            {t.short_people > 0 && (
              <Badge size="sm" tone="neutral">
                {t.short_people} with short days
              </Badge>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 text-[12.5px] text-ink-3">Timesheets are visible to the team lead and HR.</p>
      )}
    </button>
  )
}

function HoursCell({ w }: { w: WeekFacts | null }) {
  if (!w) return <span className="text-ink-3">—</span>
  return (
    <div className="min-w-[120px]">
      <div className="tnum whitespace-nowrap text-[13px]">
        {fmtHours(w.hours)} <span className="text-ink-3">/ {fmtHours(w.target_to_date)}</span>
      </div>
      <Progress className="mt-1" value={w.hours} max={Math.max(w.target_to_date, 1)} tone={pctTone(w.hours, w.target_to_date)} height={4} />
    </div>
  )
}

function GroupDetail({ g, onPerson }: { g: TeamGroup; onPerson: (m: TeamMember) => void }) {
  const t = g.totals
  const cols: Column<TeamMember>[] = [
    {
      key: 'name',
      header: 'Person',
      sortValue: (m) => m.name,
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={m.name} hue={m.avatar_hue} size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-ink">{m.name}</span>
              {m.is_lead && (
                <Badge size="sm" tone="brand">
                  {g.kind === 'department' ? 'Head' : 'Lead'}
                </Badge>
              )}
            </div>
            <div className="truncate text-[12px] text-ink-3">{[m.title, m.location].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      hideBelow: 'xl',
      sortValue: (m) => m.manager_name ?? '',
      cell: (m) => (
        <div className="min-w-0 text-[13px]">
          <div className="truncate text-ink-2">{m.manager_name ?? '—'}</div>
          <div className="tnum truncate text-[12px] text-ink-3">joined {fmtDate(m.joined_on)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'This week',
      sortValue: (m) => m.week?.status ?? 'zz',
      cell: (m) => (m.week ? <StatusBadge size="sm" map={WEEK_STATUS} value={m.week.status} /> : <span className="text-[12.5px] text-ink-3">Hidden</span>),
    },
    {
      key: 'hours',
      header: 'Hours vs target',
      sortValue: (m) => (m.week ? m.week.hours - m.week.target_to_date : 0),
      cell: (m) => <HoursCell w={m.week} />,
    },
    {
      key: 'short',
      header: 'Short days',
      align: 'right',
      sortValue: (m) => m.week?.short_days ?? 0,
      cell: (m) => (m.week ? <span className={cn('tnum', m.week.short_days ? 'text-warning-text' : 'text-ink-3')}>{m.week.short_days}</span> : <span className="text-ink-3">—</span>),
    },
  ]
  return (
    <Card pad={false} className="min-w-0">
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold">{g.name}</h2>
            <p className="text-[12.5px] text-ink-3">
              {g.lead_name ? `${g.kind === 'department' ? 'Head' : 'Lead'}: ${g.lead_name}` : 'No lead'}
              {g.department_name ? ` · ${g.department_name}` : ''} · {t.members} {t.members === 1 ? 'person' : 'people'}
            </p>
            {g.description && g.kind !== 'unassigned' && <p className="mt-1 text-[13px] text-ink-2">{g.description}</p>}
          </div>
          {t.visible > 0 && (
            <div className="text-right">
              <div className="tnum text-[15px] font-semibold">
                {fmtHours(t.hours)} <span className="text-[13px] font-normal text-ink-3">/ {fmtHours(t.target_to_date)}</span>
              </div>
              <div className="text-[12px] text-ink-3">team hours vs target to date · week target {fmtHours(t.target)}</div>
            </div>
          )}
        </div>
      </div>
      <DataTable
        rows={g.members}
        rowKey={(m) => m.id}
        columns={cols}
        onRowClick={onPerson}
        empty={<EmptyState icon={<UserCog />} title="No active members" body="Add people to this team under Organisation setup › Teams." />}
        mobileCard={(m) => (
          <div className="flex min-w-0 items-start gap-2.5">
            <Avatar name={m.name} hue={m.avatar_hue} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-medium">{m.name}</span>
                {m.week ? <StatusBadge size="sm" map={WEEK_STATUS} value={m.week.status} /> : null}
              </div>
              <div className="truncate text-[12.5px] text-ink-3">{[m.title, m.location].filter(Boolean).join(' · ') || '—'}</div>
              {m.week && (
                <div className="mt-2">
                  <HoursCell w={m.week} />
                  {m.week.short_days > 0 && (
                    <div className="mt-1 text-[12px] text-warning-text">
                      {m.week.short_days} short day
                      {m.week.short_days === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      />
    </Card>
  )
}

function PersonSheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const c = useCan()
  const w = m.week
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} width={560} title={m.name} subtitle={[m.title, m.employee_code].filter(Boolean).join(' · ')}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2.5 text-[13px] font-semibold text-ink-2">Details</h3>
          <KV
            cols={2}
            items={[
              { label: 'Manager', value: m.manager_name ?? '—' },
              { label: 'Department', value: m.department ?? '—' },
              {
                label: 'Location',
                value: m.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-ink-3" />
                    {m.location}
                  </span>
                ) : (
                  '—'
                ),
              },
              { label: 'Joined', value: fmtDate(m.joined_on, 'long') },
              {
                label: 'Email',
                value: (
                  <a href={`mailto:${m.email}`} className="inline-flex min-w-0 items-center gap-1 break-all text-brand-text hover:underline">
                    <Mail className="size-3.5 shrink-0" />
                    {m.email}
                  </a>
                ),
              },
              {
                label: 'Phone',
                value: m.phone ? (
                  <a href={`tel:${m.phone}`} className="tnum inline-flex items-center gap-1 text-brand-text hover:underline">
                    <Phone className="size-3.5" />
                    {m.phone}
                  </a>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </section>
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-2">Week of {w ? weekLabel(w.week_start) : '—'}</h3>
            {w && <StatusBadge size="sm" map={WEEK_STATUS} value={w.status} />}
          </div>
          {w ? (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <StatCard label="Logged" value={<span className="tnum">{fmtHours(w.hours)}</span>} />
                <StatCard label="Target to date" value={<span className="tnum">{fmtHours(w.target_to_date)}</span>} sub={`week ${fmtHours(w.target)}`} />
                <StatCard label="Short days" value={w.short_days} tone={w.short_days ? 'warning' : undefined} />
              </div>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {w.days.map((x) => (
                  <li key={x.date} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                    <span className="w-[92px] shrink-0 text-ink-2">{day(x.date)}</span>
                    <div className="min-w-0 flex-1">
                      {x.working ? (
                        <Progress value={x.hours} max={Math.max(x.target, 1)} tone={x.short ? 'warning' : x.hours >= x.target && x.target > 0 ? 'success' : 'brand'} height={5} />
                      ) : (
                        <span className="text-[12px] text-ink-3">{x.hours > 0 ? 'Off day (time logged)' : 'Off day'}</span>
                      )}
                    </div>
                    <span className="tnum w-[76px] shrink-0 text-right">
                      {fmtHours(x.hours)}
                      {x.working && <span className="text-ink-3"> / {fmtHours(x.target)}</span>}
                    </span>
                    {x.leave && (
                      <Badge size="sm" tone="info">
                        {x.leave === 'full' ? 'Leave' : 'Half day'}
                      </Badge>
                    )}
                    {x.short && (
                      <Badge size="sm" tone="warning">
                        Short
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              {w.submitted_at && (
                <p className="mt-2 text-[12.5px] text-ink-3">
                  Submitted {fmtDate(w.submitted_at.slice(0, 10))}
                  {w.late ? ' · late' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-3">Only the team lead, their manager and HR see this person’s timesheet.</p>
          )}
        </section>
        <div className="flex flex-wrap gap-2">
          {c('team.view') && (
            <Link to="/team/timesheets" className="inline-flex h-9 items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface-2">
              Timesheet grid
            </Link>
          )}
          <Link to={`/performance/${m.id}`} className="inline-flex h-9 items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface-2">
            Performance
          </Link>
          {c('documents.employee_files') && (
            <Link to={`/documents/employees/${m.id}`} className="inline-flex h-9 items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface-2">
              Documents
            </Link>
          )}
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
