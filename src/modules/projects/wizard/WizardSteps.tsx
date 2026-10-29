// The six input steps of the New Project wizard. Each edits its slice of the draft; numbers, provisional dates and
// validation come from the server preview (pv). Errors are keyed by the API field (customer.gstin, details.name,
// resources.0.pct, additional_costs.1.description, milestones.items.0.tasks.2.title, escalation.rows.1.email …).
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, FileText, ListChecks, Paperclip, Plus, Trash2, X } from '@/ui/icons'
import type { BillingModel, ProjectType, RevenueStream } from '@/types/entities'
import type { CustomerOption, CustomerOptions, WizardPreview } from '@/api/projectWizard'
import type { CostingPreview } from '@/api/projects'
import { usePermissionHolders } from '@/api/core'
import { BILLING_MODEL, PROJECT_TYPE, STREAM } from '@/domain/labels'
import { PROJECT_PRIORITY } from '@/domain/delivery'
import { COMMERCIAL_MODELS, parseMilestoneLines } from '@/domain/costing'
import { fmtDate } from '@/domain/calendar'
import { fmtMoney, fmtMoneyExact, fmtNum, fmtPct } from '@/domain/money'
import { cn } from '@/lib/utils'
import { Badge, Button, Callout, Combobox, Field, IconButton, Input, MoneyInput, PeoplePicker, PersonName, Segmented, Select, Textarea, useCan } from '@/ui'
import { CustomerForm } from '@/modules/clients/CustomerForm'
import { CalendarLine, CostingEditor } from '../costing/CostingEditor'
import { CommercialsEditor } from '../costing/CommercialsEditor'
import { CostChain } from '../costing/CostChain'
import { DEFAULT_STREAM, newEscRow, newMilestone, newTask, reindexRows, validateEscRows, type EscDraftRow, type MsDraft, type StepKey, type TaskDraft, type WizardDraft } from './wizardDraft'

export interface StepProps {
  d: WizardDraft
  update: (fn: (x: WizardDraft) => WizardDraft) => void
  errors: Record<string, string>
  clearErrors: (prefix: string) => void
  pv: WizardPreview | undefined
  loading: boolean
  customers: CustomerOptions | undefined
  goto: (k: StepKey) => void
}

/** errors under a prefix, with the prefix removed ("customer.gstin" → "gstin") */
function under(errors: Record<string, string>, prefix: string) {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]))
}

/* ================================================================== */
/* 1. Customer                                                          */
/* ================================================================== */
export function CustomerStep({ d, update, errors, clearErrors, customers }: StepProps) {
  const c = d.customer
  const canCreate = customers?.can_create ?? true
  const picked = customers?.items.find((x) => x.id === c.client_id) ?? null
  const setMode = (mode: 'existing' | 'new' | 'internal') => {
    clearErrors('customer')
    update((x) => ({ ...x, customer: { ...x.customer, mode } }))
  }
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-2">A customer has many projects — the customer is the parent. Pick one you work with, add a new one, or mark the project as internal work.</p>
      <Field label="This project is for" required error={errors['customer.mode']}>
        <Segmented
          block
          value={c.mode ?? ('' as 'existing')}
          onChange={setMode}
          options={[
            { value: 'existing', label: 'An existing customer' },
            ...(canCreate ? [{ value: 'new' as const, label: 'A new customer' }] : []),
            { value: 'internal', label: 'Internal work' },
          ]}
        />
      </Field>
      {c.mode === 'existing' && (
        <>
          <Field label="Customer" required error={errors['customer.client_id']} htmlFor="wz-customer" hint={customers && !customers.items.length ? 'No customers yet. Add a new one instead.' : undefined}>
            <Combobox
              id="wz-customer"
              value={c.client_id}
              invalid={!!errors['customer.client_id']}
              placeholder="Search customers"
              searchPlaceholder="Name, GSTIN or city"
              options={(customers?.items ?? []).map((x) => ({ value: x.id, label: x.name, hint: [x.gstin, x.city, x.projects ? `${x.projects} project${x.projects === 1 ? '' : 's'}` : 'no projects yet'].filter(Boolean).join(' · ') }))}
              onChange={(v) => {
                clearErrors('customer')
                update((x) => ({ ...x, customer: { ...x.customer, client_id: v } }))
              }}
            />
          </Field>
          {picked && <CustomerSummary c={picked} />}
        </>
      )}
      {c.mode === 'new' && (
        <CustomerForm
          idPrefix="wz-cu"
          value={c.new}
          errors={under(errors, 'customer.')}
          canSeePayments={customers?.can_see_payments ?? true}
          onChange={(v) => {
            clearErrors('customer')
            update((x) => ({ ...x, customer: { ...x.customer, new: v } }))
          }}
        />
      )}
      {c.mode === 'internal' && (
        <Field label="Shown as" htmlFor="wz-internal" hint="Internal projects (your own products, R&D, admin) have no customer and no billing to a client.">
          <Input id="wz-internal" value={c.internal_label} onChange={(e) => update((x) => ({ ...x, customer: { ...x.customer, internal_label: e.target.value } }))} />
        </Field>
      )}
    </div>
  )
}

export function CustomerSummary({ c, compact }: { c: CustomerOption; compact?: boolean }) {
  const reg = c.registered_address
  const rows: [string, ReactNode][] = [
    ['Registered name', c.registered_name || '—'],
    ['GSTIN', <span className="tnum">{c.gstin || (c.country && !/^india$/i.test(c.country) ? 'Overseas' : 'Not on file')}</span>],
    ['PAN', <span className="tnum">{c.pan || '—'}</span>],
    ['CIN', <span className="tnum">{c.cin || '—'}</span>],
    ['Billing address', [c.billing_address, [c.city, c.state].filter(Boolean).join(', '), c.pincode].filter(Boolean).join(' · ') || '—'],
    ['Registered address', reg ? (reg.same_as_billing ? 'Same as billing' : [reg.line, [reg.city, reg.state].filter(Boolean).join(', '), reg.pincode].filter(Boolean).join(' · ')) : '—'],
    ['Primary contact', [c.primary_contact, c.email, c.phone].filter(Boolean).join(' · ') || '—'],
    ['Payment terms', c.payment_terms_days !== null ? `${c.payment_terms_days} days${c.has_payments_profile ? ' · payments profile on file' : ''}` : '—'],
  ]
  return (
    <dl className={cn('grid gap-x-6 gap-y-2 rounded-lg border border-line bg-surface-2/40 p-3 text-[13px]', !compact && 'sm:grid-cols-2')}>
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ================================================================== */
/* 2. Project & client details                                          */
/* ================================================================== */
const DOC_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt', 'md', 'csv']
const DOC_MAX = 20 * 1024 * 1024

export function DetailsStep({ d, update, errors, clearErrors, pv, customers }: StepProps) {
  const can = useCan()
  const manageAll = can('projects.manage_all')
  const pms = usePermissionHolders('projects.edit')
  const f = d.details
  const e = (k: string) => errors[`details.${k}`]
  const set = <K extends keyof WizardDraft['details']>(k: K, v: WizardDraft['details'][K]) => {
    clearErrors(`details.${String(k)}`)
    update((x) => ({ ...x, details: { ...x.details, [k]: v } }))
  }
  const setCd = (k: keyof WizardDraft['details']['client_details'], v: string) => update((x) => ({ ...x, details: { ...x.details, client_details: { ...x.details.client_details, [k]: v } } }))
  const picked = d.customer.mode === 'existing' ? customers?.items.find((x) => x.id === d.customer.client_id) : null
  const contacts = picked?.contacts?.length ? picked.contacts : picked?.primary_contact ? [{ name: picked.primary_contact, role: '', email: picked.email, phone: picked.phone, primary: true }] : d.customer.mode === 'new' ? d.customer.new.contacts ?? [] : []
  const fileRef = useRef<HTMLInputElement>(null)
  const [docError, setDocError] = useState<string | null>(e('documents') ?? null)
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...d.docs]
    for (const file of Array.from(list)) {
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
      if (!DOC_EXT.includes(ext)) return setDocError(`${file.name}: use PDF, images (PNG, JPG, GIF, WebP, SVG), text (TXT, MD) or CSV.`)
      if (file.size > DOC_MAX) return setDocError(`${file.name} is larger than 20 MB.`)
      if (!next.some((x) => x.name === file.name && x.size === file.size)) next.push(file)
    }
    setDocError(null)
    update((x) => ({ ...x, docs: next.slice(0, 20) }))
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Field label="Project name" required error={e('name')} htmlFor="wz-name" className="sm:col-span-2 xl:col-span-4">
          <Input id="wz-name" autoFocus value={f.name} invalid={!!e('name')} onChange={(ev) => set('name', ev.target.value)} placeholder="e.g. Customer portal rollout" />
        </Field>
        <Field label="Priority" htmlFor="wz-prio" className="xl:col-span-2">
          <Select id="wz-prio" value={String(f.priority)} onChange={(ev) => set('priority', Number(ev.target.value))} options={PROJECT_PRIORITY.map((p) => ({ value: String(p.value), label: p.label }))} />
        </Field>
        <Field label="Project manager" required error={e('pm_id')} className="sm:col-span-2 xl:col-span-2" hint={!manageAll ? 'You manage the projects you create.' : undefined}>
          {manageAll ? (
            <PeoplePicker value={f.pm_id} placeholder="Choose a PM" invalid={!!e('pm_id')} onChange={(v) => set('pm_id', v)} filter={(p) => (pms ? pms.has(p.id) : p.role === 'pm' || p.role === 'admin')} />
          ) : (
            <div className="flex h-[var(--ctl-h)] items-center rounded-md border border-line bg-surface-2 px-3">
              <PersonName id={f.pm_id} size={22} />
            </div>
          )}
        </Field>
        <Field label="Start" required error={e('start_on')} htmlFor="wz-start" className="xl:col-span-2">
          <Input id="wz-start" type="date" value={f.start_on} invalid={!!e('start_on')} onChange={(ev) => set('start_on', ev.target.value)} />
        </Field>
        <Field label="Planned end" required error={e('end_on')} htmlFor="wz-end" className="xl:col-span-2">
          <Input id="wz-end" type="date" min={f.start_on} value={f.end_on} invalid={!!e('end_on')} onChange={(ev) => set('end_on', ev.target.value)} />
        </Field>
        <CalendarLine className="sm:col-span-2 xl:col-span-6" preview={pv?.costing ?? null} />
        <Field label="Project type" required error={e('type')} className="sm:col-span-2 xl:col-span-3">
          <Segmented
            block
            value={f.type}
            onChange={(v) => update((x) => ({ ...x, details: { ...x.details, type: v as ProjectType, stream: x.details.streamTouched ? x.details.stream : DEFAULT_STREAM[v as ProjectType] } }))}
            options={(Object.keys(PROJECT_TYPE) as ProjectType[]).map((k) => ({ value: k, label: PROJECT_TYPE[k] }))}
          />
        </Field>
        <Field label="Commercial model" required error={e('billing_model')} htmlFor="wz-model" className="xl:col-span-3" hint={f.billing_model === 'tm' ? 'Time & material: the contract value is the estimated billing.' : undefined}>
          <Select id="wz-model" value={f.billing_model} onChange={(ev) => set('billing_model', ev.target.value as BillingModel)} options={COMMERCIAL_MODELS.map((m) => ({ value: m.value, label: BILLING_MODEL[m.value] }))} />
        </Field>
        <Field label="Revenue stream" required error={e('stream')} htmlFor="wz-stream" className="xl:col-span-3" hint="Drives revenue by stream on the CEO dashboard.">
          <Select id="wz-stream" value={f.stream} onChange={(ev) => update((x) => ({ ...x, details: { ...x.details, stream: ev.target.value as RevenueStream, streamTouched: true } }))} options={(Object.keys(STREAM) as RevenueStream[]).map((k) => ({ value: k, label: STREAM[k] }))} />
        </Field>
        <Field label="Description" htmlFor="wz-desc" className="sm:col-span-2 xl:col-span-6">
          <Textarea id="wz-desc" rows={2} value={f.description} onChange={(ev) => set('description', ev.target.value)} placeholder="Scope in a sentence or two. The client view shows this." />
        </Field>
      </div>

      <section>
        <h3 className="text-[14px] font-semibold">Client details for this project</h3>
        <p className="mb-3 text-[12.5px] text-ink-3">The customer’s person for this project and the purchase order / work order reference.</p>
        {contacts.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-ink-3">Use a contact:</span>
            {contacts.map((ct) => (
              <Button key={ct.name + ct.email} size="sm" variant="ghost" onClick={() => update((x) => ({ ...x, details: { ...x.details, client_details: { ...x.details.client_details, contact_name: ct.name, contact_role: ct.role, contact_email: ct.email, contact_phone: ct.phone } } }))}>
                {ct.name}
              </Button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Contact person" htmlFor="wz-cdn"><Input id="wz-cdn" value={f.client_details.contact_name} onChange={(ev) => setCd('contact_name', ev.target.value)} /></Field>
          <Field label="Their role" htmlFor="wz-cdr"><Input id="wz-cdr" value={f.client_details.contact_role} onChange={(ev) => setCd('contact_role', ev.target.value)} placeholder="e.g. Project sponsor" /></Field>
          <Field label="E-mail" htmlFor="wz-cde" error={e('client_details.contact_email')}><Input id="wz-cde" type="email" value={f.client_details.contact_email} invalid={!!e('client_details.contact_email')} onChange={(ev) => setCd('contact_email', ev.target.value)} /></Field>
          <Field label="Phone" htmlFor="wz-cdp"><Input id="wz-cdp" inputMode="tel" value={f.client_details.contact_phone} onChange={(ev) => setCd('contact_phone', ev.target.value)} /></Field>
          <Field label="PO / work order reference" htmlFor="wz-po"><Input id="wz-po" value={f.client_details.po_reference} onChange={(ev) => setCd('po_reference', ev.target.value)} placeholder="e.g. PO-2026-0142" /></Field>
          <Field label="Notes" htmlFor="wz-cdnotes"><Input id="wz-cdnotes" value={f.client_details.notes} onChange={(ev) => setCd('notes', ev.target.value)} /></Field>
        </div>
      </section>

      <section>
        <h3 className="text-[14px] font-semibold">Documents</h3>
        <p className="mb-2 text-[12.5px] text-ink-3">PDF, images, text or CSV; up to 20 MB each. Filed under the project’s documents.</p>
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.csv" onChange={(ev) => { addFiles(ev.target.files); ev.target.value = '' }} />
        <Button size="sm" icon={<Paperclip className="size-4" />} onClick={() => fileRef.current?.click()}>Choose files</Button>
        {d.docs.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {d.docs.map((doc) => (
              <li key={doc.name + doc.size} className="flex min-w-0 items-center gap-3 px-3 py-2">
                <FileText className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{doc.name}</span>
                <span className="tnum shrink-0 text-[12px] text-ink-3">{doc.size >= 1048576 ? `${(doc.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(doc.size / 1024))} KB`}</span>
                <IconButton label={`Remove ${doc.name}`} size="sm" onClick={() => update((x) => ({ ...x, docs: x.docs.filter((y) => y !== doc) }))}><X className="size-4" /></IconButton>
              </li>
            ))}
          </ul>
        )}
        {(docError || e('documents')) && <p className="mt-1.5 text-[12.5px] font-medium text-danger-text">{docError || e('documents')}</p>}
      </section>
    </div>
  )
}

/* ================================================================== */
/* 3. Resource allocation                                               */
/* ================================================================== */
export function ResourcesStep({ d, update, errors, clearErrors, pv, loading, goto }: StepProps) {
  if (pv && !pv.can_plan_cost)
    return (
      <Callout tone="info" title="Resource allocation needs costing rights">
        Your role can’t plan allocations with costs (it needs the margins or salaries permission and allocation rights). Go on — someone with those rights can allocate people on the project’s Team & allocation tab.
      </Callout>
    )
  const c = pv?.costing
  const t = c?.totals
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-2">
        Add everyone who works on the project with their % of time. Each person’s share flows straight into the cost — the panel below shows what each one adds.{' '}
        {d.milestones.length ? 'Rows can sit on a milestone from step 5 or span All milestones.' : <>Rows span the project (All milestones) until you add milestones in <button type="button" className="font-medium text-brand-text hover:underline" onClick={() => goto('milestones')}>step 5</button>.</>}
      </p>
      <CostingEditor
        draft={d.costing}
        onChange={(x) => {
          clearErrors('resources')
          update((w) => ({ ...w, costing: x }))
        }}
        preview={c ? (c as Required<CostingPreview>) : undefined}
        errors={errors}
        loading={loading}
        hideCommercials
        hideTotals
        allowAll
        showShare
      />
      {t && t.resources !== null && t.resource_rows > 0 && (
        <p className="tnum text-[13px] text-ink-2">
          Resource cost <span className="font-semibold text-ink">{fmtMoneyExact(t.resources)}</span> · {fmtNum(t.man_days, 1)} man-days · {t.people} {t.people === 1 ? 'person' : 'people'}
        </p>
      )}
    </div>
  )
}

/* ================================================================== */
/* 4. Commercials                                                       */
/* ================================================================== */
export function CommercialsStep({ d, update, errors, clearErrors, pv, loading }: StepProps) {
  const c = pv?.costing
  const money = !!pv?.can_plan_cost && !!c?.can_see_money
  const follow = d.details.contract_value_paise === null
  return (
    <div className="space-y-6">
      {!money ? (
        <Callout tone="info" title="Costing is for editors">
          Cost lines, margin and price need the margins or salaries permission. Set the contract value below; someone with costing rights can add the plan on the project’s Costing & margin tab.
        </Callout>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            Total cost = resource cost + office & hardware + expenses + miscellaneous (+ maintenance) → + contingency = actual cost → + profit margin (50% of actual cost unless you change it) = price.
          </p>
          <CommercialsEditor
            draft={d.costing}
            onChange={(x) => {
              clearErrors('additional_costs')
              clearErrors('costing')
              update((w) => ({ ...w, costing: x }))
            }}
            preview={c}
            errors={errors}
          />
          {c?.totals && c.totals.total_cost !== null && (
            <section aria-label="Price chain" className={cn('transition-opacity', loading && 'opacity-70')}>
              <CostChain t={c.totals} contingencyPct={c.contingency_pct} markupPct={c.markup_pct} belowFloor={c.below_floor} />
              {c.below_floor && (
                <Callout tone="danger" className="mt-3">
                  Margin on price {fmtPct(c.totals.margin)} is below the {c.floor_pct}% floor. Raise the price or profit margin, or trim costs.
                </Callout>
              )}
            </section>
          )}
        </>
      )}
      <Field
        label={d.details.billing_model === 'tm' ? 'Estimated billing (₹)' : 'Contract value (₹)'}
        error={errors['details.contract_value_paise']}
        className="max-w-[420px]"
        hint={follow && money ? 'Follows the price above. Type to set it yourself. Excluding GST.' : 'Excluding GST.'}
        aside={!follow && money ? <button type="button" className="text-[12.5px] font-medium text-brand-text hover:underline" onClick={() => update((x) => ({ ...x, details: { ...x.details, contract_value_paise: null } }))}>Use the price</button> : undefined}
      >
        <MoneyInput aria-label="Contract value" value={follow ? (money ? pv?.contract_value_paise ?? 0 : 0) : d.details.contract_value_paise} onChange={(v) => update((x) => ({ ...x, details: { ...x.details, contract_value_paise: v } }))} />
      </Field>
    </div>
  )
}

/* ================================================================== */
/* 5. Milestones & WBS (optional)                                       */
/* ================================================================== */
export function MilestonesStep({ d, update, errors, clearErrors, pv, onSkip }: StepProps & { onSkip: () => void }) {
  const [paste, setPaste] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const parsed = useMemo(() => parseMilestoneLines(paste), [paste])
  const ms = d.milestones
  const planned = pv?.milestones ?? []
  const setMs = (key: string, patch: Partial<MsDraft>) => {
    clearErrors('milestones')
    update((x) => ({ ...x, milestones: x.milestones.map((m) => (m.key === key ? { ...m, ...patch } : m)) }))
  }
  const remove = (i: number) => {
    clearErrors('milestones')
    update((x) => ({ ...x, milestones: x.milestones.filter((_, j) => j !== i), costing: reindexRows(x.costing, i) }))
  }
  const addFromPaste = () => {
    const items = parsed.items.filter((x) => !x.error)
    update((x) => ({ ...x, milestonesSkipped: false, milestones: [...x.milestones, ...items.map((it) => ({ ...newMilestone(it.name), billing_amount_paise: it.amount_paise }))] }))
    setPaste('')
  }
  const billing = ms.reduce((s, m) => s + m.billing_amount_paise, 0)
  if (d.milestonesSkipped)
    return (
      <Callout tone="info" title="Milestones skipped for now" action={<Button size="sm" onClick={() => update((x) => ({ ...x, milestonesSkipped: false }))}>Add milestones</Button>}>
        The project is created without milestones. Add them later on the project’s WBS tab (or import a WBS from a spreadsheet).
      </Callout>
    )
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-[280px] text-[13px] text-ink-2">
          Optional. Milestones are numbered M1, M2… in delivery order; deadlines are spread across the project (by billing share) unless you set every end date. Each milestone can carry tasks, subtasks and details. Once tasks exist, a milestone’s deadline is the target end of its last task.
        </p>
        <Button variant="ghost" onClick={onSkip}>Skip — add them later</Button>
      </div>

      <ol className="space-y-3">
        {ms.map((m, i) => (
          <MilestoneCard key={m.key} m={m} i={i} planned={planned[i]} errors={errors} onChange={(p) => setMs(m.key, p)} onRemove={() => remove(i)} min={d.details.start_on} max={d.details.end_on} />
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Plus className="size-4" />} onClick={() => update((x) => ({ ...x, milestones: [...x.milestones, newMilestone()] }))}>Add milestone</Button>
      </div>
      {ms.length > 0 && (
        <p className="tnum text-[12.5px] text-ink-3">
          {ms.length} milestone{ms.length === 1 ? '' : 's'} · billing {fmtMoney(billing)}
          {pv?.contract_value_paise ? ` of a ${fmtMoney(pv.contract_value_paise)} contract` : ''} · {pv?.task_count ?? 0} task{pv?.task_count === 1 ? '' : 's'}
        </p>
      )}

      <div className="rounded-lg border border-line">
        <button type="button" aria-expanded={pasteOpen} onClick={() => setPasteOpen(!pasteOpen)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13.5px] font-medium text-ink">
          Quick add: paste milestones, one per line
          <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', pasteOpen && 'rotate-180')} />
        </button>
        {pasteOpen && <div className="space-y-2 border-t border-line p-3">
          <Field label={<>One per line in delivery order, with an optional billing amount after a | e.g. “UAT sign-off | 200000”</>} error={parsed.errors[0]}>
            <Textarea aria-label="Milestones, one per line" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} className="tnum" placeholder={'Requirements sign-off | 150000\nCore modules | 300000\nUAT sign-off | 200000'} />
          </Field>
          <Button size="sm" disabled={!parsed.items.some((x) => !x.error)} onClick={addFromPaste}>Add {parsed.items.filter((x) => !x.error).length || ''} milestone{parsed.items.filter((x) => !x.error).length === 1 ? '' : 's'}</Button>
        </div>}
      </div>
    </div>
  )
}

function MilestoneCard({ m, i, planned, errors, onChange, onRemove, min, max }: { m: MsDraft; i: number; planned?: { planned_start: string; planned_end: string }; errors: Record<string, string>; onChange: (p: Partial<MsDraft>) => void; onRemove: () => void; min: string; max: string }) {
  const [open, setOpen] = useState(!!m.details)
  const p = `milestones.items.${i}`
  const setTask = (k: string, patch: Partial<TaskDraft>) => onChange({ tasks: m.tasks.map((t) => (t.key === k ? { ...t, ...patch } : t)) })
  return (
    <li className="@container rounded-lg border border-line">
      <div className="grid grid-cols-[32px_minmax(0,1fr)_36px] items-start gap-2 p-3 @min-[640px]:grid-cols-[32px_minmax(0,1fr)_170px_160px_36px]">
        <span className="tnum mt-2.5 text-center text-[12.5px] font-semibold text-ink-3">M{i + 1}</span>
        <Field label="Milestone" error={errors[`${p}.name`]} htmlFor={`wz-ms-${m.key}`}>
          <Input id={`wz-ms-${m.key}`} value={m.name} invalid={!!errors[`${p}.name`]} placeholder="e.g. UAT sign-off" onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <IconButton className="mt-6 @min-[640px]:order-last" label={`Remove milestone ${i + 1}`} size="sm" onClick={onRemove}><Trash2 className="size-4" /></IconButton>
        <div className="col-span-2 col-start-2 grid grid-cols-2 gap-2 @min-[640px]:col-span-2 @min-[640px]:col-start-auto">
          <Field label="Billing (₹)" error={errors[`${p}.billing_amount_paise`]}>
            <MoneyInput aria-label={`Milestone ${i + 1} billing`} value={m.billing_amount_paise} onChange={(v) => onChange({ billing_amount_paise: v })} />
          </Field>
          <Field label="End (optional)" error={errors[`${p}.planned_end`]} htmlFor={`wz-mse-${m.key}`}>
            <Input id={`wz-mse-${m.key}`} type="date" min={min} max={max} value={m.planned_end} invalid={!!errors[`${p}.planned_end`]} onChange={(e) => onChange({ planned_end: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 text-[12.5px] text-ink-3">
        {planned && <span className="tnum">Provisional {fmtDate(planned.planned_start)} – {fmtDate(planned.planned_end)}</span>}
        <button type="button" className="font-medium text-brand-text hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide details' : m.details ? 'Show details' : 'Add details'}</button>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <Textarea aria-label={`Milestone ${i + 1} details`} rows={2} value={m.details} onChange={(e) => onChange({ details: e.target.value })} placeholder="Acceptance criteria, deliverables, what the client signs off" />
        </div>
      )}
      <div className="border-t border-line bg-surface-2/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2"><ListChecks className="size-4 text-ink-3" />Tasks {m.tasks.length > 0 && <Badge size="sm">{m.tasks.reduce((s, t) => s + 1 + t.subtasks.length, 0)}</Badge>}</span>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => onChange({ tasks: [...m.tasks, newTask()] })}>Add task</Button>
        </div>
        <ul className="space-y-2">
          {m.tasks.map((t, j) => (
            <TaskEditor key={t.key} t={t} label={`${i + 1}.${j + 1}`} prefix={`${p}.tasks.${j}`} errors={errors} onChange={(patch) => setTask(t.key, patch)} onRemove={() => onChange({ tasks: m.tasks.filter((x) => x.key !== t.key) })} min={min} max={max} />
          ))}
        </ul>
      </div>
    </li>
  )
}

function TaskEditor({ t, label, prefix, errors, onChange, onRemove, min, max, sub }: { t: TaskDraft; label: string; prefix: string; errors: Record<string, string>; onChange: (p: Partial<TaskDraft>) => void; onRemove: () => void; min: string; max: string; sub?: boolean }) {
  const e = (k: string) => errors[`${prefix}.${k}`]
  const setSub = (k: string, patch: Partial<TaskDraft>) => onChange({ subtasks: t.subtasks.map((s) => (s.key === k ? { ...s, ...patch } : s)) })
  return (
    <li className={cn('@container rounded-md border border-line bg-surface', sub && 'border-dashed')}>
      <div className="grid grid-cols-[minmax(0,1fr)_36px] items-start gap-2 p-2 @min-[620px]:grid-cols-[minmax(0,1fr)_200px_92px_36px_36px]">
        <div className="min-w-0">
          <Input aria-label={`Task ${label} title`} value={t.title} invalid={!!e('title')} placeholder={sub ? 'Subtask' : 'Task title'} onChange={(ev) => onChange({ title: ev.target.value })} />
          {(e('title') || e('owner_id') || e('est_hours') || e('start_on') || e('due_on')) && <p className="mt-1 text-[12.5px] font-medium text-danger-text">{e('title') || e('owner_id') || e('est_hours') || e('start_on') || e('due_on')}</p>}
        </div>
        <IconButton label={`Remove ${sub ? 'subtask' : 'task'} ${label}`} size="sm" className="@min-[620px]:order-last" onClick={onRemove}><X className="size-4" /></IconButton>
        <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_92px_36px] gap-2 @min-[620px]:contents">
          <PeoplePicker value={t.owner_id} placeholder="Owner" clearable invalid={!!e('owner_id')} onChange={(v) => onChange({ owner_id: v })} />
          <Input aria-label={`Task ${label} estimated hours`} type="number" min={0} max={999} step={0.25} suffix="h" value={t.est_hours} invalid={!!e('est_hours')} onChange={(ev) => onChange({ est_hours: ev.target.value })} className="tnum" />
          <IconButton label={t.open ? `Hide details of ${label}` : `Show details of ${label}`} size="sm" onClick={() => onChange({ open: !t.open })}>
            <ChevronDown className={cn('size-4 transition-transform', t.open && 'rotate-180')} />
          </IconButton>
        </div>
      </div>
      {t.open && (
        <div className="grid gap-2 border-t border-line p-2 @min-[520px]:grid-cols-2">
          <Field label="Start" htmlFor={`wz-ts-${t.key}`} hint="Empty = the milestone’s start"><Input id={`wz-ts-${t.key}`} type="date" min={min} max={max} value={t.start_on} invalid={!!e('start_on')} onChange={(ev) => onChange({ start_on: ev.target.value })} /></Field>
          <Field label="Due" htmlFor={`wz-td-${t.key}`} hint="Empty = two working days after the start"><Input id={`wz-td-${t.key}`} type="date" min={t.start_on || min} max={max} value={t.due_on} invalid={!!e('due_on')} onChange={(ev) => onChange({ due_on: ev.target.value })} /></Field>
          <Field label="Details" htmlFor={`wz-tdesc-${t.key}`} className="@min-[520px]:col-span-2"><Textarea id={`wz-tdesc-${t.key}`} rows={2} value={t.description} onChange={(ev) => onChange({ description: ev.target.value })} placeholder="What done looks like, links, notes" /></Field>
          {!sub && (
            <div className="@min-[520px]:col-span-2">
              <ul className="space-y-2">
                {t.subtasks.map((s, k) => (
                  <TaskEditor key={s.key} sub t={s} label={`${label}.${k + 1}`} prefix={`${prefix}.subtasks.${k}`} errors={errors} onChange={(patch) => setSub(s.key, patch)} onRemove={() => onChange({ subtasks: t.subtasks.filter((x) => x.key !== s.key) })} min={min} max={max} />
                ))}
              </ul>
              <Button size="sm" variant="ghost" className="mt-1" icon={<Plus className="size-4" />} onClick={() => onChange({ subtasks: [...t.subtasks, { ...newTask(), est_hours: '4', open: false }] })}>Add subtask</Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/* ================================================================== */
/* 6. Escalation matrix                                                 */
/* ================================================================== */
export function EscalationStep({ d, update, errors, clearErrors }: StepProps) {
  return (
    <EscalationEditor
      rows={d.escalation.rows}
      notes={d.escalation.notes}
      errors={under(errors, 'escalation.')}
      onChange={(rows, notes) => {
        clearErrors('escalation')
        update((x) => ({ ...x, escalation: { rows, notes } }))
      }}
    />
  )
}

/** Shared with the project's Escalation tab. `errors` keyed rows.<i>.<field> / notes. */
export function EscalationEditor({ rows, notes, onChange, errors = {}, readOnly }: { rows: EscDraftRow[]; notes: string; onChange: (rows: EscDraftRow[], notes: string) => void; errors?: Record<string, string>; readOnly?: boolean }) {
  const set = (k: string, patch: Partial<EscDraftRow>) => onChange(rows.map((r) => (r.key === k ? { ...r, ...patch } : r)), notes)
  // V9-FIX (item 10): the server's row rules, checked as soon as the person leaves a row they typed in
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const local = useMemo(() => validateEscRows(rows, notes), [rows, notes])
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-2">Who is called when something slips, in order. Level 1 first; if it isn’t resolved within the time given, it moves to the next level.</p>
      {rows.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-3">No escalation levels yet.</p>}
      <ol className="space-y-3">
        {rows.map((r, i) => {
          const e = (f: string) => errors[`rows.${i}.${f}`] ?? (touched.has(r.key) ? local[`rows.${i}.${f}`] : undefined)
          const rowErr = e('level') || e('user_id') || e('name') || e('email') || e('after_value')
          return (
            <li key={r.key} className="@container rounded-lg border border-line p-3" onBlurCapture={() => !touched.has(r.key) && setTouched((t) => new Set(t).add(r.key))}>
              <div className="grid gap-3 @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_36px]">
                <Field label="Level" htmlFor={`esc-l-${r.key}`}>
                  <Select id={`esc-l-${r.key}`} value={r.level} disabled={readOnly} onChange={(ev) => set(r.key, { level: ev.target.value })} options={[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `Level ${n}` }))} />
                </Field>
                <Field
                  label={r.who === 'person' ? 'Person' : 'Name'}
                  aside={!readOnly ? <button type="button" className="text-[12px] font-medium text-brand-text hover:underline" onClick={() => set(r.key, { who: r.who === 'person' ? 'external' : 'person', user_id: null })}>{r.who === 'person' ? 'Someone outside' : 'From the team'}</button> : undefined}
                  htmlFor={`esc-n-${r.key}`}
                >
                  {r.who === 'person' ? (
                    <PeoplePicker id={`esc-n-${r.key}`} value={r.user_id} invalid={!!e('user_id') || !!e('name')} onChange={(v) => set(r.key, { user_id: v })} />
                  ) : (
                    <Input id={`esc-n-${r.key}`} value={r.name} disabled={readOnly} invalid={!!e('name')} placeholder="e.g. Client’s IT head" onChange={(ev) => set(r.key, { name: ev.target.value })} />
                  )}
                </Field>
                <Field label="Role" htmlFor={`esc-r-${r.key}`}>
                  <Input id={`esc-r-${r.key}`} value={r.role} disabled={readOnly} placeholder="e.g. Delivery head" onChange={(ev) => set(r.key, { role: ev.target.value })} />
                </Field>
                <Field label="Escalate after" htmlFor={`esc-a-${r.key}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <Input id={`esc-a-${r.key}`} type="number" min={0} max={999} value={r.after_value} disabled={readOnly} invalid={!!e('after_value')} onChange={(ev) => set(r.key, { after_value: ev.target.value })} className="tnum" />
                    <Select aria-label="Unit" value={r.after_unit} disabled={readOnly} onChange={(ev) => set(r.key, { after_unit: ev.target.value as EscDraftRow['after_unit'] })} options={[{ value: 'hours', label: 'hours' }, { value: 'days', label: 'days' }, { value: 'working_days', label: 'working days' }]} />
                  </div>
                </Field>
                {!readOnly && (
                  <div className="flex items-start justify-end @min-[860px]:pt-6">
                    <IconButton label={`Remove level ${r.level}`} size="sm" onClick={() => onChange(rows.filter((x) => x.key !== r.key), notes)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
                <Field label="E-mail" htmlFor={`esc-e-${r.key}`} hint={r.who === 'person' ? 'Empty = their work e-mail' : undefined}>
                  <Input id={`esc-e-${r.key}`} type="email" value={r.email} disabled={readOnly} invalid={!!e('email')} onChange={(ev) => set(r.key, { email: ev.target.value })} />
                </Field>
                <Field label="Phone" htmlFor={`esc-p-${r.key}`}>
                  <Input id={`esc-p-${r.key}`} inputMode="tel" value={r.phone} disabled={readOnly} onChange={(ev) => set(r.key, { phone: ev.target.value })} />
                </Field>
                <Field label="Scope" htmlFor={`esc-s-${r.key}`} className="@min-[480px]:col-span-2 @min-[860px]:col-span-2">
                  <Input id={`esc-s-${r.key}`} value={r.scope} disabled={readOnly} placeholder="e.g. Delivery delays, commercial disputes" onChange={(ev) => set(r.key, { scope: ev.target.value })} />
                </Field>
              </div>
              {rowErr && <p className="mt-2 text-[12.5px] font-medium text-danger-text">{rowErr}</p>}
            </li>
          )
        })}
      </ol>
      {!readOnly && (
        <Button icon={<Plus className="size-4" />} onClick={() => onChange([...rows, newEscRow(Math.min(9, (Math.max(0, ...rows.map((r) => Number(r.level) || 0)) || 0) + 1))], notes)}>
          Add level
        </Button>
      )}
      <Field label="Notes" htmlFor="esc-notes" error={errors.notes} hint="How to escalate (call first, then e-mail), out-of-hours rules, the client’s own escalation path.">
        <Textarea id="esc-notes" rows={5} value={notes} disabled={readOnly} onChange={(ev) => onChange(rows, ev.target.value)} placeholder={'1. Call the level-1 contact; if no answer in 2 hours, e-mail with the ticket link.\n2. Commercial issues go straight to level 3.'} />
      </Field>
    </div>
  )
}
