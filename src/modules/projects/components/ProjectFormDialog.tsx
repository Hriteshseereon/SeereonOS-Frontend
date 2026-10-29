// Edit project (Feature Guide §3, G3.06–G3.07; v9 customers D2). Creating a project is the New Project wizard
// (/projects/new); this dialog edits an existing one: name, customer, client details, PM, dates, type, commercial
// model, priority, revenue stream, contract value and description. Status changes live in the status control (the
// reason is recorded); the costing plan is on the Costing & margin tab; the escalation matrix on its own tab.
import { useEffect, useState } from 'react'
import type { BillingModel, Project, ProjectType, RevenueStream } from '@/types/entities'
import { projectsApi } from '@/api/projects'
import { usePermissionHolders } from '@/api/core'
import { useMut } from '@/api/query'
import { ApiError } from '@/api/http'
import { useCustomerOptions, type ProjectClientDetails, type ProjectV9 } from '@/api/projectWizard'
import { BILLING_MODEL, PROJECT_TYPE, STREAM } from '@/domain/labels'
import { PROJECT_PRIORITY } from '@/domain/delivery'
import { COMMERCIAL_MODELS } from '@/domain/costing'
import { Button, Combobox, Dialog, Field, Input, MoneyInput, PeoplePicker, PersonName, Segmented, Select, Textarea, useCan } from '@/ui'

type Form = {
  name: string
  client: string
  client_id: string | null
  type: ProjectType
  billing_model: BillingModel
  stream: RevenueStream
  pm_id: string | null
  start_on: string
  end_on: string
  contract_value_paise: number
  priority: number
  description: string
  client_details: ProjectClientDetails
}
const EMPTY_CD: ProjectClientDetails = { contact_name: '', contact_role: '', contact_email: '', contact_phone: '', po_reference: '', notes: '' }

export function ProjectFormDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project | null }) {
  const can = useCan()
  const manageAll = can('projects.manage_all')
  const pms = usePermissionHolders('projects.edit')
  const customers = useCustomerOptions(open)
  const p = project as ProjectV9 | null | undefined
  const fromProject = (): Form | null =>
    p
      ? {
          name: p.name, client: p.client, client_id: p.client_id ?? null, type: p.type, billing_model: p.billing_model, stream: p.stream, pm_id: p.pm_id, start_on: p.start_on, end_on: p.end_on,
          contract_value_paise: p.contract_value_paise, priority: p.priority, description: p.description, client_details: { ...EMPTY_CD, ...(p.client_details ?? {}) },
        }
      : null
  const [f, setF] = useState<Form | null>(fromProject)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(fromProject())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, p?.id, p?.version])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => (x ? { ...x, [k]: v } : x))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const onErr = (e: ApiError) => {
    if (e.field) setErrors((x) => ({ ...x, [e.field!.replace(/^client_details\./, 'client_details.')]: e.message }))
  }
  const save = useMut((b: Record<string, unknown>) => projectsApi.update(p!.id, b as never, p!.version), {
    invalidate: [['projects'], ['project', p?.id], ['clients'], ['customers']],
    success: 'Project updated',
    onSuccess: () => onOpenChange(false),
    onError: onErr,
  })
  if (!p || !f) return null

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Give the project a name.'
    if (!f.client_id && !f.client.trim()) e.client = 'Pick the customer, or type “Internal” for your own work.'
    if (!f.pm_id) e.pm_id = 'Choose the project manager.'
    if (!f.start_on) e.start_on = 'Pick a start date.'
    if (!f.end_on) e.end_on = 'Pick the planned end.'
    if (f.start_on && f.end_on && f.end_on < f.start_on) e.end_on = 'The planned end is before the start date.'
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const b: Record<string, unknown> = {
      name: f.name, type: f.type, billing_model: f.billing_model, stream: f.stream, start_on: f.start_on, end_on: f.end_on, contract_value_paise: f.contract_value_paise, priority: f.priority, description: f.description,
      client_details: f.client_details,
    }
    if ((f.client_id ?? null) !== (p.client_id ?? null)) b.client_id = f.client_id
    if (!f.client_id) b.client = f.client
    if (f.pm_id !== p.pm_id) b.pm_id = f.pm_id
    save.mutate(b)
  }
  const cd = f.client_details
  const setCd = (k: keyof ProjectClientDetails, v: string) => set('client_details', { ...cd, [k]: v })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Edit ${p.code}`}
      description="Status changes live in the status control, so the reason is recorded. The costing plan is on the Costing & margin tab; the escalation matrix on the Escalation tab."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Project name" required error={errors.name} htmlFor="pf-name" className="sm:col-span-2 lg:col-span-3">
          <Input id="pf-name" autoFocus value={f.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Customer" required error={errors.client || errors.client_id} htmlFor="pf-customer" className="sm:col-span-2 lg:col-span-3" hint={!f.client_id ? 'Not linked to a customer (internal work, or a name not in Customers yet).' : undefined}>
          <Combobox
            id="pf-customer"
            value={f.client_id}
            clearable
            placeholder={f.client || 'Choose a customer'}
            searchPlaceholder="Search customers"
            options={(customers.data?.items ?? []).map((c) => ({ value: c.id, label: c.name, hint: [c.gstin, c.city].filter(Boolean).join(' · ') || undefined }))}
            onChange={(v) => setF((x) => (x ? { ...x, client_id: v, client: v ? customers.data?.items.find((c) => c.id === v)?.name ?? x.client : x.client } : x))}
          />
        </Field>
        {!f.client_id && (
          <Field label="Client name (not linked)" htmlFor="pf-client" className="sm:col-span-2 lg:col-span-6">
            <Input id="pf-client" value={f.client} invalid={!!errors.client} onChange={(e) => set('client', e.target.value)} placeholder="Company name or Internal" />
          </Field>
        )}
        <Field label="Project manager" required error={errors.pm_id} className="sm:col-span-2 lg:col-span-2" hint={!manageAll ? 'Only an admin can hand the project to another PM.' : undefined}>
          {manageAll ? (
            <PeoplePicker value={f.pm_id} placeholder="Choose a PM" onChange={(v) => set('pm_id', v)} invalid={!!errors.pm_id} filter={(x) => (pms ? pms.has(x.id) : x.role === 'pm' || x.role === 'admin')} />
          ) : (
            <div className="flex h-[var(--ctl-h)] items-center rounded-md border border-line bg-surface-2 px-3"><PersonName id={f.pm_id} size={22} /></div>
          )}
        </Field>
        <Field label="Start" required error={errors.start_on} htmlFor="pf-start" className="lg:col-span-2">
          <Input id="pf-start" type="date" value={f.start_on} invalid={!!errors.start_on} onChange={(e) => set('start_on', e.target.value)} />
        </Field>
        <Field label="Planned end" required error={errors.end_on} htmlFor="pf-end" className="lg:col-span-2">
          <Input id="pf-end" type="date" value={f.end_on} min={f.start_on} invalid={!!errors.end_on} onChange={(e) => set('end_on', e.target.value)} />
        </Field>
        <Field label="Project type" required className="sm:col-span-2 lg:col-span-3">
          <Segmented block value={f.type} onChange={(v) => set('type', v)} options={(Object.keys(PROJECT_TYPE) as ProjectType[]).map((k) => ({ value: k, label: PROJECT_TYPE[k] }))} />
        </Field>
        <Field label="Commercial model" required htmlFor="pf-model" className="lg:col-span-3">
          <Select id="pf-model" value={f.billing_model} onChange={(e) => set('billing_model', e.target.value as BillingModel)} options={COMMERCIAL_MODELS.map((m) => ({ value: m.value, label: BILLING_MODEL[m.value] }))} />
        </Field>
        <Field label="Priority" htmlFor="pf-prio" className="lg:col-span-3">
          <Select id="pf-prio" value={String(f.priority)} onChange={(e) => set('priority', Number(e.target.value))} options={PROJECT_PRIORITY.map((x) => ({ value: String(x.value), label: x.label }))} />
        </Field>
        <Field label="Revenue stream" required htmlFor="pf-stream" className="lg:col-span-3">
          <Select id="pf-stream" value={f.stream} onChange={(e) => set('stream', e.target.value as RevenueStream)} options={(Object.keys(STREAM) as RevenueStream[]).map((k) => ({ value: k, label: STREAM[k] }))} />
        </Field>
        <Field label={f.billing_model === 'tm' ? 'Estimated billing (₹)' : 'Contract value (₹)'} error={errors.contract_value_paise} className="sm:col-span-2 lg:col-span-3" hint="Excluding GST.">
          <MoneyInput aria-label="Contract value" value={f.contract_value_paise} onChange={(v) => set('contract_value_paise', v)} invalid={!!errors.contract_value_paise} />
        </Field>
        <Field label="Description" htmlFor="pf-desc" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="pf-desc" value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} className="min-h-[var(--ctl-h)]" />
        </Field>
      </div>
      <section className="mt-6">
        <h3 className="mb-2 text-[14px] font-semibold">Client details for this project</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Contact person" htmlFor="pf-cdn"><Input id="pf-cdn" value={cd.contact_name} onChange={(e) => setCd('contact_name', e.target.value)} /></Field>
          <Field label="Their role" htmlFor="pf-cdr"><Input id="pf-cdr" value={cd.contact_role} onChange={(e) => setCd('contact_role', e.target.value)} /></Field>
          <Field label="E-mail" htmlFor="pf-cde" error={errors['client_details.contact_email']}><Input id="pf-cde" type="email" value={cd.contact_email} onChange={(e) => setCd('contact_email', e.target.value)} /></Field>
          <Field label="Phone" htmlFor="pf-cdp"><Input id="pf-cdp" inputMode="tel" value={cd.contact_phone} onChange={(e) => setCd('contact_phone', e.target.value)} /></Field>
          <Field label="PO / work order reference" htmlFor="pf-po"><Input id="pf-po" value={cd.po_reference} onChange={(e) => setCd('po_reference', e.target.value)} /></Field>
          <Field label="Notes" htmlFor="pf-notes"><Input id="pf-notes" value={cd.notes} onChange={(e) => setCd('notes', e.target.value)} /></Field>
        </div>
      </section>
    </Dialog>
  )
}
