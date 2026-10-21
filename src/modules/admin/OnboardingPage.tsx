import { Link, useNavigate } from 'react-router-dom'
import { EyeOff } from '@/ui/icons'
import { useMut } from '@/api/query'
import { adminApi, useOnboarding } from '@/api/admin'
import { useSession } from '@/stores/session'
import { fmtDate } from '@/domain/calendar'
import { Button, Callout, ErrorState, PageHeader, Progress, SkeletonRows, useReadOnly } from '@/ui'
import { OnboardingChecklist } from './OnboardingCard'

export default function OnboardingPage() {
  const q = useOnboarding()
  const { user, tenant } = useSession()
  const readOnly = useReadOnly()
  const nav = useNavigate()
  const dismiss = useMut(() => adminApi.dismissOnboarding(), { invalidate: [['onboarding']], success: 'Checklist hidden from Home', onSuccess: () => nav('/home') })
  const restore = useMut(() => adminApi.restoreOnboarding(), { invalidate: [['onboarding']], success: 'Checklist is back on Home' })

  return (
    <div className="max-w-[800px]">
      <PageHeader title={`Welcome${user ? `, ${user.name.split(' ')[0]}` : ''}`} subtitle="Five steps get your team logging time against real projects. Most companies finish in about ten minutes." />
      {q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : q.error || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <section className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="flex items-center gap-4 px-4 py-4 md:px-5">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{q.data.complete ? 'All set — your workspace is ready' : `${q.data.done} of ${q.data.total} steps done`}</div>
                <Progress value={q.data.done / q.data.total} className="mt-2 max-w-[360px]" tone={q.data.complete ? 'success' : 'brand'} />
              </div>
            </div>
            <div className="border-t border-line">
              <OnboardingChecklist data={q.data} />
            </div>
          </section>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {q.data.dismissed ? (
              <Button variant="ghost" loading={restore.isPending} disabled={readOnly} onClick={() => restore.mutate(undefined)}>
                Show checklist on Home again
              </Button>
            ) : (
              <Button variant="ghost" icon={<EyeOff className="size-4" />} loading={dismiss.isPending} disabled={readOnly} onClick={() => dismiss.mutate(undefined)}>
                Dismiss checklist
              </Button>
            )}
            <Link to="/home" className="text-center text-[13.5px] font-medium text-brand-text hover:underline">
              Go to Home
            </Link>
          </div>
          {tenant?.status === 'trial' && (
            <Callout tone="brand" className="mt-6" action={<Link to="/billing" className="text-[13px] font-medium text-brand-text hover:underline">Plans</Link>}>
              You’re on a free trial until {fmtDate(tenant.trial_ends_on, 'long')}. Everything is unlocked.
            </Callout>
          )}
        </>
      )}
    </div>
  )
}
