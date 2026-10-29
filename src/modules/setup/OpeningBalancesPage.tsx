// Admin › Opening balances (v9, D10): cash, bank, receivables, payables and other ledger balances at the start of a
// financial year. Editable until the FY has transactions; then locked unless reopened with a reason (maker-checker
// "Financial-year opening balances" when it is on). The cash + bank opening feeds the cash position (ledger, P&L
// runway, CEO dashboard). All validation and totals are server-side (backend/app/routes/admin_setup.py).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, Lock, LockOpen, Plus, Trash2 } from '@/ui/icons'
import { toast } from 'sonner'
import { useMut } from '@/api/query'
import { isPending } from '@/api/changes'
import { adminSetupApi, useOpenings, type OpeningKind, type OpeningLine, type OpeningsView } from '@/api/adminSetup'
import { fmtMoney } from '@/domain/money'
import { fmtDateTime } from '@/domain/calendar'
import { Badge, Button, Callout, ErrorState, Field, IconButton, Input, MoneyInput, PageHeader, Select, SkeletonRows, Textarea, useConfirm, useReadOnly, useUnsavedChanges } from '@/ui'
import { cn } from '@/lib/utils'
import { SaveBar } from '../admin/kit'
import { PendingBanner } from '../access/kit'

const SECTIONS: { kind: OpeningKind; title: string; hint: string; namePh: string }[] = [
  { kind: 'cash', title: 'Cash in hand', hint: 'Petty cash and other cash balances.', namePh: 'e.g. Petty cash — head office' },
  { kind: 'bank', title: 'Bank accounts', hint: 'Balance of each account on the first day of the FY. Use credit for an overdraft.', namePh: 'e.g. HDFC current a/c ••1234' },
  { kind: 'receivable', title: 'Receivables', hint: 'What customers owed you at the FY start (unpaid invoices of earlier years).', namePh: 'Customer' },
  { kind: 'payable', title: 'Payables', hint: 'What you owed vendors at the FY start.', namePh: 'Vendor' },
  { kind: 'ledger', title: 'Other ledger accounts', hint: 'Capital, loans, fixed assets, deposits, GST and TDS balances…', namePh: 'e.g. Share capital' },
]

type Draft = { lines: OpeningLine[]; notes: string }
const toDraft = (v: OpeningsView): Draft => ({ lines: v.lines.map(({ party_name: _p, ...l }) => ({ ...l })), notes: v.notes })
let seq = 0
const newLine = (kind: OpeningKind): OpeningLine => ({ id: `new_${Date.now()}_${seq++}`, kind, name: '', side: kind === 'payable' ? 'credit' : 'debit', amount_paise: 0 })

export default function OpeningBalancesPage() {
  const [fy, setFy] = useState<number | undefined>(undefined)
  const q = useOpenings(fy)
  const readOnly = useReadOnly()
  const { askReason, confirm } = useConfirm()
  const v = q.data
  const [d, setD] = useState<Draft | null>(null)
  const loadedFor = useRef<string>('')
  useEffect(() => {
    if (!v) return
    const k = `${v.fy_start_year}:${v.version ?? 0}`
    if (loadedFor.current !== k) {
      loadedFor.current = k
      setD(toDraft(v))
    }
  }, [v])
  const editable = !!v && v.can_edit && !readOnly && !v.locked && !v.pending
  const dirty = !!v && !!d && JSON.stringify(d) !== JSON.stringify(toDraft(v))
  const { confirmDiscard, release } = useUnsavedChanges(editable && dirty, { title: 'Discard opening balance changes?', body: 'Your changes haven’t been saved.' })
  const [fieldErr, setFieldErr] = useState<{ field: string; message: string } | null>(null)

  const save = useMut(() => adminSetupApi.saveOpenings(v!.fy_start_year, { lines: d!.lines, notes: d!.notes }, v!.version), {
    success: `${v?.fy_label} opening balances saved`,
    silentError: true,
    onSuccess: () => {
      setFieldErr(null)
      release()
    },
  })
  useEffect(() => {
    const e = save.error as { field?: string; message: string } | null
    if (e) {
      setFieldErr(e.field ? { field: e.field, message: e.message } : null)
      if (!e.field) toast.error(e.message)
    }
  }, [save.error])
  const lock = useMut(() => adminSetupApi.lockOpenings(v!.fy_start_year, v!.version), { success: 'Opening balances locked' })
  const reopen = useMut((reason: string) => adminSetupApi.reopenOpenings(v!.fy_start_year, reason), {
    onSuccess: (r) => (isPending(r) ? toast.message('Sent for approval', { description: 'A second person must approve reopening the balances.' }) : toast.success('Opening balances reopened')),
  })

  // live totals of the draft (display only; the server recomputes on save)
  const tot = useMemo(() => {
    const t = { cash_bank: 0, receivables: 0, payables: 0, debits: 0, credits: 0 }
    for (const l of d?.lines ?? []) {
      const a = l.amount_paise || 0
      if (l.side === 'credit') t.credits += a
      else t.debits += a
      if (l.kind === 'cash' || l.kind === 'bank') t.cash_bank += l.side === 'credit' ? -a : a
      if (l.kind === 'receivable') t.receivables += a
      if (l.kind === 'payable') t.payables += a
    }
    return t
  }, [d])

  if (q.isLoading || (!d && !q.error)) return <SkeletonRows rows={8} />
  if (q.error || !v || !d) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const setLine = (id: string | undefined, patch: Partial<OpeningLine>) => setD({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const errFor = (i: number, f: string) => (fieldErr && fieldErr.field === `lines.${i}.${f}` ? fieldErr.message : fieldErr && fieldErr.field === `lines.${i}` && f === 'name' ? fieldErr.message : null)
  const yearOpts = [...new Map([...v.years, { fy_start_year: v.fy_start_year, fy_label: v.fy_label }].map((y) => [y.fy_start_year, y])).values()].sort((a, b) => b.fy_start_year - a.fy_start_year)

  return (
    <div className="pb-24">
      <PageHeader
        title="Opening balances"
        subtitle="Balances brought forward at the start of the financial year. Cash and bank become the opening of the cash position on the ledger, P&L and CEO dashboard."
        meta={
          <>
            {v.locked ? <Badge tone="neutral">Locked</Badge> : v.reopened ? <Badge tone="warning">Reopened</Badge> : <Badge tone="success">Editable</Badge>}
            <span className="text-[12.5px] text-ink-3">As of {v.as_of} · {v.fy_label}</span>
          </>
        }
        actions={
          <>
            <Select
              aria-label="Financial year"
              className="w-[140px]"
              value={String(v.fy_start_year)}
              onChange={async (e) => {
                if (await confirmDiscard()) setFy(Number(e.target.value))
              }}
              options={yearOpts.map((y) => ({ value: String(y.fy_start_year), label: y.fy_label }))}
            />
            {v.can_edit && !readOnly && v.locked && !v.pending && (
              <Button
                size="sm"
                icon={<LockOpen className="size-3.5" />}
                loading={reopen.isPending}
                onClick={async () => {
                  const r = await askReason({ title: `Reopen ${v.fy_label} opening balances?`, body: `They are locked because ${v.lock_reason}. Changing them changes the cash position of every later month. The reason goes to the audit trail.`, label: 'Reason', minLength: 10, confirmLabel: 'Reopen' })
                  if (r) reopen.mutate(r)
                }}
              >
                Reopen
              </Button>
            )}
            {v.can_edit && !readOnly && !v.locked && v.exists && v.lines.length > 0 && (
              <Button
                size="sm"
                icon={<Lock className="size-3.5" />}
                loading={lock.isPending}
                disabled={dirty}
                title={dirty ? 'Save first' : undefined}
                onClick={async () => (await confirm({ title: `Lock ${v.fy_label} opening balances?`, body: 'Nobody can change them afterwards without reopening them with a reason.', confirmLabel: 'Lock' })) && lock.mutate(undefined)}
              >
                Lock
              </Button>
            )}
          </>
        }
      />

      {v.pending && <PendingBanner pending={v.pending} what="Reopening these balances" />}
      {v.locked ? (
        <Callout tone="neutral" icon={<Lock />} className="mb-4" title="Locked">
          {v.lock_reason ? `Locked because ${v.lock_reason}.` : 'Locked.'} {v.can_edit ? 'Reopen with a reason to correct them.' : 'Only finance can reopen them.'}
          {v.locked_by_name && v.locked_at && ` Locked by ${v.locked_by_name}, ${fmtDateTime(v.locked_at)}.`}
        </Callout>
      ) : v.reopened ? (
        <Callout tone="warning" icon={<LockOpen />} className="mb-4" title={`Reopened by ${v.reopened_by_name ?? 'someone'}`}>
          “{v.reopen_reason}”. Save your corrections, then lock them again.
        </Callout>
      ) : (
        <Callout tone="info" className="mb-4">
          {v.has_transactions ? '' : 'You can edit these until the first transaction of the year is recorded (a ledger entry, an issued invoice or a payment); then they lock.'}
          {v.legacy_opening_cash_paise ? ` Until you enter cash or bank balances here, the cash position starts from the opening cash in Company settings (${fmtMoney(v.legacy_opening_cash_paise)}).` : ''}
        </Callout>
      )}

      <div className="mb-5 grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-4 md:divide-x">
        {[
          ['Cash & bank', tot.cash_bank],
          ['Receivables', tot.receivables],
          ['Payables', tot.payables],
          ['Debits − credits', tot.debits - tot.credits],
        ].map(([k, val], i) => (
          <div key={k as string} className={cn('min-w-0 px-3.5 py-3 md:px-4', i % 2 === 1 && 'border-l border-line md:border-l-0', i >= 2 && 'border-t border-line md:border-t-0')}>
            <div className="text-[12.5px] leading-tight text-ink-3">{k}</div>
            <div className={cn('tnum mt-1.5 whitespace-nowrap text-[17px] font-semibold leading-tight md:text-[20px]', k === 'Debits − credits' && (val as number) !== 0 && 'text-warning-text')}>{fmtMoney(val as number)}</div>
            {k === 'Debits − credits' && <div className="mt-0.5 truncate text-[12px] text-ink-3">{(val as number) === 0 ? 'Balanced' : 'Not balanced yet'}</div>}
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {SECTIONS.map((s) => {
          const rows = d.lines.map((l, i) => ({ l, i })).filter((x) => x.l.kind === s.kind)
          const parties = s.kind === 'receivable' ? v.parties.customers : s.kind === 'payable' ? v.parties.vendors : null
          const sum = rows.reduce((a, x) => a + (x.l.side === 'credit' && s.kind !== 'payable' ? -x.l.amount_paise : x.l.amount_paise), 0)
          return (
            <section key={s.kind} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold">{s.title}</h2>
                  <p className="text-[12.5px] text-ink-3">{s.hint}</p>
                </div>
                <span className="tnum whitespace-nowrap text-[14px] font-semibold">{fmtMoney(sum)}</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">Nothing entered.</p>
              ) : (
                <div className="hidden gap-2.5 border-b border-line bg-surface-2/60 px-4 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_minmax(0,1fr)_40px]">
                  <span>{parties ? (s.kind === 'receivable' ? 'Customer' : 'Vendor') : 'Account'}</span>
                  <span>Reference</span>
                  <span>{parties ? 'Due date' : 'Balance'}</span>
                  <span>Amount</span>
                  <span />
                </div>
              )}
              <ul className="divide-y divide-line">
                {rows.map(({ l, i }) => (
                  <li key={l.id} className="grid gap-2.5 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_minmax(0,1fr)_40px] md:items-start">
                    <Field error={errFor(i, 'name') ?? errFor(i, 'party_id')}>
                      {parties ? (
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <Select
                            aria-label={s.namePh}
                            disabled={!editable}
                            value={l.party_id ?? ''}
                            onChange={(e) => {
                              const p = parties.find((x) => x.id === e.target.value)
                              setLine(l.id, { party_id: e.target.value || null, name: p ? p.name : l.name })
                            }}
                            options={[{ value: '', label: parties.length ? `Pick a ${s.kind === 'receivable' ? 'customer' : 'vendor'} or type below` : 'Type the name below' }, ...parties.map((p) => ({ value: p.id, label: p.name }))]}
                          />
                          {!l.party_id && <Input aria-label={`${s.namePh} name`} disabled={!editable} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} placeholder={`${s.namePh} name`} invalid={!!errFor(i, 'name')} />}
                        </div>
                      ) : (
                        <Input aria-label="Account name" disabled={!editable} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} placeholder={s.namePh} invalid={!!errFor(i, 'name')} />
                      )}
                    </Field>
                    <Field error={errFor(i, 'reference')}>
                      <Input aria-label="Reference" disabled={!editable} value={l.reference ?? ''} onChange={(e) => setLine(l.id, { reference: e.target.value })} placeholder={parties ? 'Invoice / bill no.' : s.kind === 'ledger' ? 'Category or note' : 'Account no.'} />
                    </Field>
                    {s.kind === 'cash' || s.kind === 'bank' || s.kind === 'ledger' ? (
                      <Select aria-label="Debit or credit" disabled={!editable} value={l.side} onChange={(e) => setLine(l.id, { side: e.target.value as 'debit' | 'credit' })} options={[{ value: 'debit', label: s.kind === 'ledger' ? 'Debit' : 'In hand' }, { value: 'credit', label: s.kind === 'ledger' ? 'Credit' : 'Overdraft' }]} />
                    ) : (
                      <Input aria-label="Due date" type="date" disabled={!editable} value={l.due_on ?? ''} onChange={(e) => setLine(l.id, { due_on: e.target.value || null })} title="Due date (optional)" />
                    )}
                    <Field error={errFor(i, 'amount_paise')}>
                      <MoneyInput aria-label="Amount" disabled={!editable} value={l.amount_paise} onChange={(p) => setLine(l.id, { amount_paise: p })} invalid={!!errFor(i, 'amount_paise')} />
                    </Field>
                    {editable ? (
                      <IconButton label="Remove line" onClick={() => setD({ ...d, lines: d.lines.filter((x) => x.id !== l.id) })} className="justify-self-end">
                        <Trash2 className="size-4" />
                      </IconButton>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="border-t border-line px-4 py-2">
                  <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setD({ ...d, lines: [...d.lines, newLine(s.kind)] })}>
                    Add {s.kind === 'cash' ? 'cash balance' : s.kind === 'bank' ? 'bank account' : s.kind === 'receivable' ? 'receivable' : s.kind === 'payable' ? 'payable' : 'account'}
                  </Button>
                </div>
              )}
            </section>
          )
        })}

        <section className="rounded-lg border border-line bg-surface p-4">
          <Field label="Notes" htmlFor="ob-notes" hint="e.g. where the figures come from (audited balance sheet of FY25-26).">
            <Textarea id="ob-notes" rows={2} disabled={!editable} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </Field>
        </section>

        {v.history.length > 0 && (
          <section className="rounded-lg border border-line bg-surface">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[14px] font-semibold">
              <History className="size-4 text-ink-3" /> History
            </h2>
            <ul className="divide-y divide-line">
              {v.history.map((h, i) => (
                <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5 text-[13px] sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="tnum shrink-0 whitespace-nowrap text-ink-3">{fmtDateTime(h.at)}</span>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="font-medium">{h.by_name ?? 'Someone'}</span> {h.action}
                    {h.reason ? ` — “${h.reason}”` : ''}
                    {h.approved_by_name ? <span className="text-ink-3"> · approved by {h.approved_by_name}</span> : null}
                    {h.totals ? <span className="text-ink-3"> · cash & bank {fmtMoney(h.totals.cash_bank)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-[12.5px] text-ink-3">
          See the effect on the <Link to="/finance/ledger" className="font-medium text-brand-text hover:underline">ledger</Link> and <Link to="/finance/pnl" className="font-medium text-brand-text hover:underline">profit &amp; loss</Link>.
        </p>
      </div>

      <SaveBar dirty={editable && dirty} saving={save.isPending} onSave={() => save.mutate(undefined)} onDiscard={async () => (await confirmDiscard()) && setD(toDraft(v))} label={fieldErr ? fieldErr.message : 'Unsaved opening balances'} />
    </div>
  )
}
