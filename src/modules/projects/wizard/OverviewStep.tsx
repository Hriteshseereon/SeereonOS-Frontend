// Step 7 — everything the wizard will create, with an Edit link per section. Numbers are the server preview's.
import type { ReactNode } from 'react'
import { Pencil } from '@/ui/icons'
import { usePeopleMap } from '@/api/core'
import { BILLING_MODEL, PROJECT_TYPE, STREAM } from '@/domain/labels'
import { PROJECT_PRIORITY } from '@/domain/delivery'
import { fmtDate } from '@/domain/calendar'
import { fmtMoney, fmtMoneyExact, fmtNum } from '@/domain/money'
import { cn } from '@/lib/utils'
import { Badge, Button, Callout } from '@/ui'
import { CostChain } from '../costing/CostChain'
import { PeopleShare } from '../costing/PeopleShare'
import { CustomerSummary, type StepProps } from './WizardSteps'
import { escRowEmpty, type StepKey } from './wizardDraft'

function Section({ title, step, goto, children, state }: { title: string; step: StepKey; goto: (k: StepKey) => void; children: ReactNode; state?: 'error' | 'skipped' }) {
  return (
    <section className={cn('rounded-lg border p-4', state === 'error' ? 'border-danger' : 'border-line')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
          <span className="truncate">{title}</span>
          {state === 'error' && <Badge tone="danger" size="sm">Needs attention</Badge>}
          {state === 'skipped' && <Badge size="sm">Skipped</Badge>}
        </h3>
        <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => goto(step)} aria-label={`Edit ${title}`}>
          Edit
        </Button>
      </div>
      {children}
    </section>
  )
}

function Kv({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function OverviewStep({ d, pv, customers, goto }: StepProps) {
  const people = usePeopleMap()
  const escRows = d.escalation.rows.filter((r) => !escRowEmpty(r)) // V9-FIX (item 10): empty levels are not saved, so not shown
  const st = (k: 'customer' | 'details' | 'resources' | 'commercials' | 'milestones' | 'escalation') => (pv?.steps[k]?.ok === false ? 'error' : undefined)
  const firstError = pv ? Object.values(pv.steps).find((s) => s.ok === false)?.error : null
  const f = d.details
  const c = pv?.costing
  const picked = d.customer.mode === 'existing' ? customers?.items.find((x) => x.id === d.customer.client_id) : null
  const ms = d.milestonesSkipped ? [] : d.milestones
  const tasks = ms.reduce((s, m) => s + m.tasks.reduce((a, t) => a + 1 + t.subtasks.length, 0), 0)
  const contract = f.contract_value_paise ?? pv?.contract_value_paise ?? 0
  return (
    <div className="space-y-4">
      {firstError ? (
        <Callout tone="danger" title="Fix this before creating">{firstError.message}</Callout>
      ) : (
        <p className="text-[13px] text-ink-2">
          Creating sets up {pv?.next_code ?? 'the project'} as Initiated with everything below in one go — {ms.length} milestone{ms.length === 1 ? '' : 's'}, {tasks} task{tasks === 1 ? '' : 's'}, {d.costing.rows.length} allocation row{d.costing.rows.length === 1 ? '' : 's'}{pv?.can_plan_cost ? ' and the costing plan' : ''}. If anything fails, nothing is created.
        </p>
      )}

      <Section title="Customer" step="customer" goto={goto} state={st('customer')}>
        {d.customer.mode === 'existing' && picked ? (
          <>
            <div className="mb-2 text-[14px] font-medium">{picked.name}</div>
            <CustomerSummary c={picked} />
          </>
        ) : d.customer.mode === 'new' ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-[14px] font-medium">{d.customer.new.name || 'New customer'} <Badge tone="brand" size="sm">New</Badge></div>
            <Kv
              items={[
                ['Registered name', d.customer.new.registered_name],
                ['GSTIN', <span className="tnum">{d.customer.new.gstin}</span>],
                ['CIN', <span className="tnum">{d.customer.new.cin}</span>],
                ['Billing address', [d.customer.new.billing_address, d.customer.new.city, d.customer.new.state, d.customer.new.pincode].filter(Boolean).join(', ')],
                ['Contacts', (d.customer.new.contacts ?? []).map((x) => x.name).filter(Boolean).join(', ')],
                ['Payments profile', d.customer.new.payments_profile ? [d.customer.new.payments_profile.bank_name, d.customer.new.payments_profile.ifsc, d.customer.new.payments_profile.upi].filter(Boolean).join(' · ') || 'Added' : 'None'],
              ]}
            />
          </>
        ) : d.customer.mode === 'internal' ? (
          <p className="text-[13px]">Internal work — {d.customer.internal_label || 'Internal'}. No customer.</p>
        ) : (
          <p className="text-[13px] text-danger-text">Not chosen yet.</p>
        )}
      </Section>

      <Section title="Project & client details" step="details" goto={goto} state={st('details')}>
        <Kv
          items={[
            ['Project', f.name],
            ['Project manager', people.get(f.pm_id)?.name ?? ''],
            ['Dates', <span className="tnum">{fmtDate(f.start_on)} – {fmtDate(f.end_on)}{c?.summary ? ` · ${c.summary.working_days} working days` : ''}</span>],
            ['Type · model', `${PROJECT_TYPE[f.type]} · ${BILLING_MODEL[f.billing_model]}`],
            ['Revenue stream', STREAM[f.stream]],
            ['Priority', PROJECT_PRIORITY.find((p) => p.value === f.priority)?.label ?? String(f.priority)],
            ['Client contact', [f.client_details.contact_name, f.client_details.contact_role, f.client_details.contact_email].filter(Boolean).join(' · ')],
            ['PO / work order', f.client_details.po_reference],
            ['Documents', d.docs.length ? `${d.docs.length} file${d.docs.length === 1 ? '' : 's'}` : 'None'],
          ]}
        />
        {f.description && <p className="mt-3 text-[13px] text-ink-2">{f.description}</p>}
      </Section>

      <Section title="Resource allocation" step="resources" goto={goto} state={st('resources')}>
        {!d.costing.rows.length ? (
          <p className="text-[13px] text-ink-3">No one allocated yet.</p>
        ) : c?.totals.people_share?.length ? (
          <PeopleShare people={c.totals.people_share} resources={c.totals.resources} />
        ) : (
          <p className="tnum text-[13px]">{d.costing.rows.length} rows · {fmtNum(c?.totals.man_days ?? 0, 1)} man-days</p>
        )}
      </Section>

      <Section title="Commercials" step="commercials" goto={goto} state={st('commercials')}>
        {c?.can_see_money && c.totals.total_cost !== null ? <CostChain t={c.totals} contingencyPct={c.contingency_pct} markupPct={c.markup_pct} belowFloor={c.below_floor} /> : <p className="text-[13px] text-ink-3">No costing plan (needs costing rights).</p>}
        <p className="tnum mt-3 text-[13px]">
          {f.billing_model === 'tm' ? 'Estimated billing' : 'Contract value'} <span className="font-semibold">{fmtMoneyExact(contract)}</span>
          {f.contract_value_paise === null && c?.can_see_money ? ' (the price)' : ''}
        </p>
      </Section>

      <Section title="Milestones & WBS" step="milestones" goto={goto} state={d.milestonesSkipped ? 'skipped' : st('milestones')}>
        {!ms.length ? (
          <p className="text-[13px] text-ink-3">{d.milestonesSkipped ? 'Skipped — add them later on the WBS tab.' : 'No milestones.'}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {ms.map((m, i) => {
              const p = pv?.milestones[i]
              const n = m.tasks.reduce((a, t) => a + 1 + t.subtasks.length, 0)
              return (
                <li key={m.key} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                  <span className="tnum w-8 shrink-0 font-semibold text-ink-3">M{i + 1}</span>
                  <span className="min-w-0 flex-1 basis-[160px] truncate">{m.name}</span>
                  {p && <span className="tnum whitespace-nowrap text-[12px] text-ink-3">{fmtDate(p.planned_start)} – {fmtDate(p.planned_end)}</span>}
                  <span className="whitespace-nowrap text-[12px] text-ink-3">{n} task{n === 1 ? '' : 's'}</span>
                  <span className="tnum whitespace-nowrap font-medium">{m.billing_amount_paise ? fmtMoney(m.billing_amount_paise) : <span className="font-normal text-ink-3">No billing</span>}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Escalation matrix" step="escalation" goto={goto} state={st('escalation')}>
        {!escRows.length && !d.escalation.notes.trim() ? (
          <p className="text-[13px] text-ink-3">None yet — you can add it later on the project’s Escalation tab.</p>
        ) : (
          <>
            <ol className="space-y-1.5 text-[13px]">
              {[...escRows].sort((a, b) => Number(a.level) - Number(b.level)).map((r) => (
                <li key={r.key} className="flex min-w-0 flex-wrap gap-x-2">
                  <span className="tnum font-semibold text-ink-3">L{r.level}</span>
                  <span className="font-medium">{r.who === 'person' ? people.get(r.user_id)?.name ?? '—' : r.name || '—'}</span>
                  {r.role && <span className="text-ink-3">{r.role}</span>}
                  {r.after_value && <span className="text-ink-3">after {r.after_value} {Number(r.after_value) === 1 ? r.after_unit.replace('_', ' ').replace(/s$/, '') : r.after_unit.replace('_', ' ')}</span>}
                </li>
              ))}
            </ol>
            {d.escalation.notes.trim() && <p className="mt-2 whitespace-pre-line text-[13px] text-ink-2">{d.escalation.notes}</p>}
          </>
        )}
      </Section>
    </div>
  )
}
