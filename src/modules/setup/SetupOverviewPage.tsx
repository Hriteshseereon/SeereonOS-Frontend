// Admin setup hub (v9, D10): every configuration area of the workspace with its status and a link — organisation,
// people & time (leave policies, holiday calendars, hours, cost rates), finance (invoice settings, opening balances)
// and access & controls. Status is computed by the server (GET /setup/hub, backend/app/routes/access.py).
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, Circle } from '@/ui/icons'
import { useSetupHub, type HubItem, type HubStatus } from '@/api/adminSetup'
import type { Action } from '@/domain/permissions'
import { Badge, ErrorState, PageHeader, Progress, SkeletonRows, useCan } from '@/ui'
import { cn } from '@/lib/utils'

const STATUS: Record<HubStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'brand' }> = {
  done: { label: 'Done', tone: 'success' },
  attention: { label: 'Needs attention', tone: 'warning' },
  todo: { label: 'To do', tone: 'neutral' },
  optional: { label: 'Optional', tone: 'neutral' },
}

export default function SetupOverviewPage() {
  const q = useSetupHub()
  const c = useCan()
  const d = q.data
  const next = d?.groups.flatMap((g) => g.items).find((i) => i.required && i.status !== 'done' && c(i.action as Action))
  return (
    <div>
      <PageHeader
        title="Admin setup"
        subtitle="Everything an administrator configures, in one place. Work top to bottom on a new workspace; come back whenever something changes."
      />
      <div className="mb-4 xl:hidden">
        <Link to="/setup?list=1" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-brand-text hover:underline">
          All setup sections <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {q.isLoading ? (
        <SkeletonRows rows={8} />
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-5">
          <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{d.complete ? `${d.company} is set up` : `${d.done} of ${d.total} areas done`}</div>
              <div className="text-[12.5px] text-ink-3">
                {d.complete ? 'Everything required is in place.' : next ? `Next: ${next.title}` : 'The remaining areas need someone with the right access.'}
                {d.attention > 0 && ` · ${d.attention} need${d.attention === 1 ? 's' : ''} attention`}
              </div>
            </div>
            <Progress value={d.total ? d.done / d.total : 0} tone={d.complete ? 'success' : 'brand'} className="sm:max-w-[240px]" />
          </section>
          <div className="grid gap-5 2xl:grid-cols-2">
            {d.groups.map((g) => (
              <section key={g.title} className="min-w-0">
                <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">{g.title}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {g.items.map((i) => (
                    <HubRow key={i.key} item={i} isNext={i === next} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HubRow({ item: i, isNext }: { item: HubItem; isNext: boolean }) {
  const c = useCan()
  const allowed = c(i.action as Action)
  const st = STATUS[i.status]
  const icon =
    i.status === 'done' ? (
      <Check className="size-4" />
    ) : i.status === 'attention' ? (
      <AlertTriangle className="size-4" />
    ) : (
      <Circle className="size-3.5" />
    )
  const inner = (
    <>
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          i.status === 'done' ? 'bg-success-soft text-success-text' : i.status === 'attention' ? 'bg-warning-soft text-warning-text' : 'border border-line-strong text-ink-3',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-medium text-ink">{i.title}</span>
          <Badge size="sm" tone={isNext ? 'brand' : st.tone}>
            {isNext ? 'Next' : st.label}
          </Badge>
          {!i.required && i.status !== 'optional' && <span className="text-[12px] text-ink-3">optional</span>}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{i.body}</span>
        <span className="tnum mt-1 block break-words text-[12.5px] text-ink-2">{i.meta}</span>
        {!allowed && <span className="mt-1 block text-[12.5px] text-ink-3">Needs someone with access to this area.</span>}
      </span>
      {allowed && <ChevronRight className="mt-1.5 size-4 shrink-0 text-ink-3" aria-hidden />}
    </>
  )
  const cls = cn('flex gap-3 px-4 py-3.5 md:px-5', isNext && 'bg-brand-soft/40')
  return (
    <li>
      {allowed ? (
        <Link to={i.to} className={cn(cls, 'transition hover:bg-surface-2')} aria-label={`${i.title}: ${st.label}`}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}
