// Customer page › Projects (v9, D2): every project of the customer (linked by client_id, or by name for older rows),
// with progress, health and contract value, and "New project" to start the wizard with this customer picked.
import { useNavigate } from 'react-router-dom'
import { Plus } from '@/ui/icons'
import { useApi } from '@/api/query'
import { wizardApi, type CustomerProjectRow } from '@/api/projectWizard'
import { HEALTH, PROJECT_STATUS, PROJECT_TYPE } from '@/domain/labels'
import { fmtDate } from '@/domain/calendar'
import { fmtMoneyCompact, fmtPct } from '@/domain/money'
import { Button, Card, CardHeader, DataTable, EmptyState, ErrorState, Progress, SkeletonRows, StatusBadge, useReadOnly, type Column } from '@/ui'

export function CustomerProjectsCard({ clientId, name }: { clientId: string; name: string }) {
  const q = useApi(['client', clientId, 'projects'], () => wizardApi.customerProjects(clientId))
  const nav = useNavigate()
  const readOnly = useReadOnly()
  const d = q.data
  const cols: Column<CustomerProjectRow>[] = [
    {
      key: 'name', header: 'Project', sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="min-w-0 max-w-[320px]">
          <div className="truncate font-medium text-ink"><span className="tnum text-ink-3">{p.code}</span> {p.name}</div>
          <div className="truncate text-[12px] text-ink-3">{PROJECT_TYPE[p.type]} · {p.pm_name}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, cell: (p) => <span className="flex flex-wrap gap-1"><StatusBadge map={PROJECT_STATUS} value={p.status} size="sm" />{['active', 'initiated'].includes(p.status) && HEALTH[p.health as keyof typeof HEALTH] && <StatusBadge map={HEALTH} value={p.health as keyof typeof HEALTH} size="sm" />}</span> },
    { key: 'progress', header: 'Progress', hideBelow: 'md', sortValue: (p) => p.progress, cell: (p) => <div className="flex min-w-[110px] items-center gap-2"><Progress value={p.progress} className="flex-1" /><span className="tnum w-10 text-right text-[12.5px] text-ink-2">{fmtPct(p.progress, 0)}</span></div> },
    { key: 'dates', header: 'Dates', hideBelow: 'lg', sortValue: (p) => p.start_on, cell: (p) => <span className="tnum whitespace-nowrap text-[12.5px] text-ink-2">{fmtDate(p.start_on)} – {fmtDate(p.end_on)}</span> },
    { key: 'value', header: 'Contract', align: 'right', sortValue: (p) => p.contract_value_paise ?? 0, cell: (p) => <span className="tnum whitespace-nowrap">{p.contract_value_paise === null ? '—' : fmtMoneyCompact(p.contract_value_paise)}</span> },
  ]
  return (
    <Card pad={false}>
      <div className="px-4 pt-4 md:px-5 md:pt-5">
        <CardHeader
          title="Projects"
          subtitle={d ? `${d.totals.projects} with ${name}${d.totals.active ? ` · ${d.totals.active} running` : ''}${d.totals.contract_value_paise ? ` · ${fmtMoneyCompact(d.totals.contract_value_paise)} contract value` : ''}` : `With ${name}`}
          action={d?.can_create_project && !readOnly ? <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => nav(`/projects/new?customer=${clientId}`)}>New project</Button> : undefined}
        />
      </div>
      <div className="px-4 pb-4 md:px-5 md:pb-5">
        {q.isLoading ? (
          <SkeletonRows rows={3} />
        ) : q.error || !d ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
        ) : (
          <DataTable
            rows={d.items}
            columns={cols}
            rowKey={(p) => p.id}
            dense
            onRowClick={(p) => nav(`/projects/${p.id}`)}
            empty={<EmptyState title="No projects yet" body={d.can_create_project ? 'Start one with the New Project wizard — this customer is picked for you.' : undefined} compact />}
            mobileCard={(p) => (
              <div>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium"><span className="tnum text-ink-3">{p.code}</span> {p.name}</div>
                    <div className="text-[12px] text-ink-3">{p.pm_name} · ends {fmtDate(p.end_on)}</div>
                  </div>
                  <StatusBadge map={PROJECT_STATUS} value={p.status} size="sm" />
                </div>
                <div className="mt-2 flex items-center gap-2"><Progress value={p.progress} className="flex-1" /><span className="tnum text-[12.5px] text-ink-2">{fmtPct(p.progress, 0)}</span>{p.contract_value_paise !== null && <span className="tnum ml-2 text-[12.5px] font-medium">{fmtMoneyCompact(p.contract_value_paise)}</span>}</div>
              </div>
            )}
          />
        )}
      </div>
    </Card>
  )
}
