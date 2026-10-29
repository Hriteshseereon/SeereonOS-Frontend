// Report catalogue (D9): report types by category — Financial, Attendance, Salary, Task, Project, Timesheet. Only the
// types this role may run are listed (the server decides; salary types need salary access).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Lock } from '@/ui/icons'
import { useReportTypeCatalogue } from '@/api/reportTypes'
import { Badge, ErrorState, FilterChips, SkeletonCards, Tooltip, useCan } from '@/ui'

export function TypeCatalogue() {
  const q = useReportTypeCatalogue()
  const c = useCan()
  const [cat, setCat] = useState<string>('all')
  if (q.isLoading) return <SkeletonCards n={6} />
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
  const cats = q.data.categories.filter((x) => x.types.length)
  const shown = cat === 'all' ? cats : cats.filter((x) => x.id === cat)
  const locked = q.data.categories.flatMap((x) => x.locked)
  return (
    <section aria-labelledby="rt-cat" className="mb-8">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="rt-cat" className="text-[15px] font-semibold text-ink">
            Start a report
          </h2>
          <p className="text-[12.5px] text-ink-3">Pick a report type, choose what goes in, run it, export it or save it.</p>
        </div>
        <FilterChips value={cat} onChange={setCat} options={[{ value: 'all', label: 'All types' }, ...cats.map((x) => ({ value: x.id, label: x.label, count: x.types.length }))]} />
      </div>
      <div className="space-y-5">
        {shown.map((g) => (
          <div key={g.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-[13.5px] font-semibold text-ink-2">{g.label}</h3>
              <span className="truncate text-[12px] text-ink-3">{g.description}</span>
            </div>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {g.types.map((t) => (
                <li key={t.id} className="min-w-0">
                  <Link to={`/reports/types/${t.id}`} className="group flex h-full min-w-0 items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition hover:border-line-strong hover:bg-surface-2/50">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">{t.label}</span>
                        {t.needs_salary && (
                          <Badge size="sm" tone="accent">
                            Salary access
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{t.description}</span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {locked.length > 0 && cat === 'all' && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
          <Lock className="size-3.5" />
          Not available for your role:
          {locked.map((l, i) => (
            <Tooltip key={l.id} content={l.reason}>
              <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">
                {l.label}
                {i < locked.length - 1 ? ',' : ''}
              </span>
            </Tooltip>
          ))}
        </p>
      )}
      {!c('reports.build') && <p className="mt-2 text-[12px] text-ink-3">You can run and export reports; saving them needs the “Build custom reports” permission.</p>}
    </section>
  )
}
