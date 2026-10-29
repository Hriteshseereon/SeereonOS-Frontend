// Documents › Team documents (v9, decision D8): team → employees → each employee's uploaded and issued documents.
// HR / CEO / admin (documents.employee_files); the server answers 403 for anyone else and employees never see other
// people's files. A person opens on /documents/employees/:userId (view, download, verify, upload, issue).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Users } from '@/ui/icons'
import { useApi } from '@/api/query'
import { teamsApi, type TeamDocGroup } from '@/api/recruiting'
import type { EmployeeSummaryRow } from '@/api/docs'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Card, DataTable, EmptyState, ErrorState, FilterChips, SearchInput, SkeletonRows, StatCard, type Column } from '@/ui'
import { MissingKinds } from './docUi'

type Filter = 'all' | 'verify' | 'missing'

export default function TeamDocumentsTab() {
  const nav = useNavigate()
  const q = useApi(['employee-docs', 'teams'], teamsApi.teamDocs)
  const [sel, setSel] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const groups = q.data?.groups ?? []
  const g = groups.find((x) => x.id === sel) ?? groups[0] ?? null
  const people = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (g?.people ?? []).filter((r) => (filter === 'verify' ? r.pending > 0 : filter === 'missing' ? r.missing.length > 0 : true) && (!s || `${r.name} ${r.code} ${r.designation}`.toLowerCase().includes(s)))
  }, [g, search, filter])
  if (q.isLoading) return <SkeletonRows rows={6} />
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!groups.length) return <Card pad={false}><EmptyState icon={<Users />} title="No employees yet" body="Invite people from Admin › People & users; their documents appear here by team." /></Card>
  const cols: Column<EmployeeSummaryRow>[] = [
    {
      key: 'n', header: 'Employee', sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name} hue={r.avatar_hue} size={28} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{r.name}</div>
            <div className="truncate text-[12px] text-ink-3"><span className="tnum">{r.code}</span>{r.code ? ' · ' : ''}{r.designation}</div>
          </div>
        </div>
      ),
    },
    { key: 'docs', header: 'Uploaded', align: 'right', sortValue: (r) => r.docs, cell: (r) => <span className="tnum text-ink-2">{r.docs}</span> },
    { key: 'v', header: 'Verified', align: 'right', hideBelow: 'lg', sortValue: (r) => r.verified, cell: (r) => <span className="tnum text-ink-2">{r.verified}</span> },
    { key: 'p', header: 'To verify', align: 'right', sortValue: (r) => r.pending, cell: (r) => (r.pending ? <Badge size="sm" tone="warning">{r.pending}</Badge> : <span className="text-ink-3">0</span>) },
    { key: 'm', header: 'Missing mandatory', hideBelow: 'xl', sortValue: (r) => r.missing.length, cell: (r) => <MissingKinds kinds={r.missing} /> },
    { key: 'i', header: 'Issued letters', align: 'right', hideBelow: 'md', sortValue: (r) => r.issued, cell: (r) => <span className="tnum text-ink-2">{r.issued}</span> },
    { key: 'go', header: '', width: '36px', cell: () => <ChevronRight className="size-4 text-ink-3" /> },
  ]
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-5">
      <nav aria-label={q.data.mode === 'teams' ? 'Teams' : 'Departments'} className="mb-4 lg:col-span-4 lg:mb-0 2xl:col-span-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {groups.map((x) => <GroupButton key={x.id} g={x} active={g?.id === x.id} onClick={() => setSel(x.id)} />)}
        </div>
        {q.data.mode === 'departments' && <p className="mt-2 hidden text-[12.5px] text-ink-3 lg:block">No teams set up yet — grouped by department.</p>}
      </nav>
      {g && (
        <div className="min-w-0 lg:col-span-8 2xl:col-span-9">
          <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            <StatCard label="People" value={g.totals.people} sub={g.lead_name ? `Lead: ${g.lead_name}` : g.name} />
            <StatCard label="Documents on file" value={g.totals.docs} sub={`${g.totals.verified} verified`} />
            <StatCard label="To verify" value={g.totals.pending} tone={g.totals.pending ? 'warning' : undefined} onClick={() => setFilter('verify')} />
            <StatCard label="Missing mandatory" value={g.totals.missing_people} sub="people" tone={g.totals.missing_people ? 'danger' : undefined} onClick={() => setFilter('missing')} />
          </div>
          <div className="mb-3 flex flex-col gap-2.5 md:flex-row md:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder={`Search ${g.name}`} className="md:max-w-[300px] md:flex-1" />
            <FilterChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: g.people.length }, { value: 'verify', label: 'To verify', count: g.people.filter((r) => r.pending).length }, { value: 'missing', label: 'Missing documents', count: g.people.filter((r) => r.missing.length).length }]} />
          </div>
          <DataTable
            rows={people}
            rowKey={(r) => r.user_id}
            columns={cols}
            onRowClick={(r) => nav(`/documents/employees/${r.user_id}`)}
            rowLabel={(r) => `Open ${r.name}’s documents`}
            empty={<EmptyState title="Nobody matches" body="Try another search or filter." />}
            mobileCard={(r) => (
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar name={r.name} hue={r.avatar_hue} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium">{r.name}</span>
                    {r.pending > 0 && <Badge size="sm" tone="warning">{r.pending} to verify</Badge>}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-3">{r.designation} · {r.docs} uploaded · {r.issued} issued</div>
                  {r.missing.length > 0 && <MissingKinds kinds={r.missing} className="mt-1.5" />}
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

function GroupButton({ g, active, onClick }: { g: TeamDocGroup; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn('min-w-[200px] shrink-0 rounded-lg border bg-surface px-3.5 py-3 text-left transition hover:bg-surface-2/60 lg:min-w-0', active ? 'border-brand ring-1 ring-brand' : 'border-line')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[14px] font-semibold">{g.name}</span>
        <span className="tnum shrink-0 text-[12.5px] text-ink-3">{g.totals.people}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] text-ink-3">
        <span className="tnum">{g.totals.docs} {g.totals.docs === 1 ? 'doc' : 'docs'}</span>
        {g.totals.pending > 0 && <Badge size="sm" tone="warning">{g.totals.pending} to verify</Badge>}
        {g.totals.missing_people > 0 && <Badge size="sm" tone="danger">{g.totals.missing_people} missing</Badge>}
      </div>
    </button>
  )
}
