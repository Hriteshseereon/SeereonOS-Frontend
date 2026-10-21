// Global "can't reach the server" banner. Shown whenever the API is unreachable (network failure, 502/503/504);
// it probes the API every 10 s and, once it answers, refreshes everything on screen and disappears.
import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from '@/ui/icons'
import { pingApi } from '@/api/http'
import { queryClient } from '@/api/query'
import { useConnectivity } from '@/stores/connectivity'
import { useSession } from '@/stores/session'
import { Button } from '@/ui'
import { cn } from '@/lib/utils'

export default function ConnectionBanner() {
  const { down, message } = useConnectivity()
  const signedIn = useSession((s) => !!s.token)
  const [checking, setChecking] = useState(false)

  const retry = async () => {
    setChecking(true)
    try {
      if (await pingApi()) {
        useConnectivity.getState().markUp()
        await queryClient.refetchQueries({ type: 'active' })
      }
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!down) return
    const t = setInterval(() => {
      pingApi().then((ok) => {
        if (ok) {
          useConnectivity.getState().markUp()
          queryClient.refetchQueries({ type: 'active' })
        }
      })
    }, 10_000)
    return () => clearInterval(t)
  }, [down])

  if (!down) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'fixed left-1/2 z-[70] flex w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 items-center gap-3 rounded-lg border border-danger/30 bg-elevated px-3.5 py-3 shadow-lg',
        signedIn ? 'bottom-[calc(76px+env(safe-area-inset-bottom,0px))] lg:bottom-6' : 'bottom-[max(16px,env(safe-area-inset-bottom,0px))]',
      )}
    >
      <AlertTriangle className="size-5 shrink-0 text-danger-text" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink">Can’t reach the server</div>
        <div className="text-[12.5px] text-ink-3">{message ?? 'Check your connection.'} Changes made now aren’t saved.</div>
      </div>
      <Button size="sm" icon={<RefreshCw className={cn('size-3.5', checking && 'animate-spin')} />} disabled={checking} onClick={retry}>
        Retry
      </Button>
    </div>
  )
}
