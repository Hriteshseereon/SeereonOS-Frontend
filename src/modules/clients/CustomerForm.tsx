// v9 (item 1, D2) customer form: registered business name, GSTIN, PAN, CIN, billing + registered address, contacts and
// an optional payments profile. Used by Customers › Add / Edit and step 1 of the New Project wizard. The server
// validates everything (formats, GSTIN ↔ state, PAN inside the GSTIN); errors arrive keyed by field.
import { useState } from 'react'
import { ChevronDown, Plus, X } from '@/ui/icons'
import { GST_STATES } from '@/domain/gst'
import type { CustomerContact, CustomerInput } from '@/api/projectWizard'
import { cn } from '@/lib/utils'
import { Button, Checkbox, Field, IconButton, Input, PeoplePicker, Select, Textarea } from '@/ui'

export const emptyCustomer = (): CustomerInput => ({
  name: '', registered_name: '', industry: '', country: 'India', gstin: '', pan: '', cin: '', billing_address: '', city: '', state: '', state_code: '', pincode: '',
  registered_address: { same_as_billing: true, line: '', city: '', state: '', state_code: '', pincode: '' }, contacts: [], payments_profile: null, payment_terms_days: 30, owner_id: null,
})

const STATE_OPTIONS = [{ value: '', label: 'Choose a state' }, ...GST_STATES.filter((g) => g.code !== '96' && g.code !== '97').map((g) => ({ value: g.code, label: `${g.name} (${g.code})` }))]
const stateName = (code: string) => GST_STATES.find((g) => g.code === code)?.name ?? ''

export function CustomerForm({
  value: f, onChange, errors = {}, idPrefix = 'cu', showOwner = true, showPayments = true, canSeePayments = true,
}: {
  value: CustomerInput
  onChange: (v: CustomerInput) => void
  /** field → message, already without any step prefix (name, gstin, contacts.0.email, payments_profile.ifsc …) */
  errors?: Record<string, string>
  idPrefix?: string
  showOwner?: boolean
  showPayments?: boolean
  /** false: the stored account number comes back masked; leave it to keep it */
  canSeePayments?: boolean
}) {
  const india = /^(india|in)$/i.test((f.country ?? 'India').trim() || 'India')
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => onChange({ ...f, [k]: v })
  const ra = f.registered_address ?? { same_as_billing: true }
  const same = ra.same_as_billing !== false
  const pp = f.payments_profile
  const [payOpen, setPayOpen] = useState(!!pp)
  const contacts = f.contacts ?? []
  const setContact = (i: number, patch: Partial<CustomerContact>) => set('contacts', contacts.map((c, j) => (j === i ? { ...c, ...patch } : patch.primary ? { ...c, primary: false } : c)))
  const id = (s: string) => `${idPrefix}-${s}`
  const e = (k: string) => errors[k]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" required error={e('name')} htmlFor={id('name')} hint="How the customer shows in lists and on projects.">
          <Input id={id('name')} value={f.name} invalid={!!e('name')} onChange={(ev) => set('name', ev.target.value)} placeholder="e.g. Odisha Rail Works" />
        </Field>
        <Field label="Registered business name" error={e('registered_name')} htmlFor={id('regname')} hint="The legal entity on invoices and contracts.">
          <Input id={id('regname')} value={f.registered_name ?? ''} onChange={(ev) => set('registered_name', ev.target.value)} placeholder="e.g. Odisha Rail Works Private Limited" />
        </Field>
        <Field label="GSTIN" error={e('gstin')} htmlFor={id('gstin')} hint={india ? '15 characters. Leave empty if not registered.' : 'Overseas customers have no GSTIN.'}>
          <Input id={id('gstin')} value={f.gstin ?? ''} maxLength={15} invalid={!!e('gstin')} onChange={(ev) => set('gstin', ev.target.value.toUpperCase())} className="tnum uppercase" />
        </Field>
        <Field label="CIN" error={e('cin')} htmlFor={id('cin')} hint="Corporate identification number (21 characters) or LLPIN.">
          <Input id={id('cin')} value={f.cin ?? ''} maxLength={21} invalid={!!e('cin')} onChange={(ev) => set('cin', ev.target.value.toUpperCase())} className="tnum uppercase" />
        </Field>
        {india && (
          <Field label="PAN" error={e('pan')} htmlFor={id('pan')} hint="Filled from the GSTIN when left empty.">
            <Input id={id('pan')} value={f.pan ?? ''} maxLength={10} invalid={!!e('pan')} onChange={(ev) => set('pan', ev.target.value.toUpperCase())} className="tnum uppercase" />
          </Field>
        )}
        <Field label="Industry" htmlFor={id('ind')}>
          <Input id={id('ind')} value={f.industry ?? ''} onChange={(ev) => set('industry', ev.target.value)} placeholder="e.g. Manufacturing" />
        </Field>
        <Field label="Country" htmlFor={id('country')}>
          <Input id={id('country')} value={f.country ?? 'India'} onChange={(ev) => set('country', ev.target.value)} />
        </Field>
        <Field label="Payment terms" htmlFor={id('terms')} error={e('payment_terms_days') ?? e('payments_profile.payment_terms_days')}>
          <Input
            id={id('terms')}
            type="number"
            min={0}
            max={180}
            suffix="days"
            value={f.payment_terms_days === undefined ? '' : String(f.payment_terms_days)}
            onChange={(ev) => {
              const n = ev.target.value === '' ? 30 : Number(ev.target.value)
              onChange({ ...f, payment_terms_days: n, ...(f.payments_profile ? { payments_profile: { ...f.payments_profile, payment_terms_days: n } } : {}) })
            }}
          />
        </Field>
        {showOwner && (
          <Field label="Account manager">
            <PeoplePicker value={f.owner_id ?? null} onChange={(v) => set('owner_id', v)} clearable />
          </Field>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-[14px] font-semibold">Billing address</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Address" htmlFor={id('bill')} className="sm:col-span-3">
            <Textarea id={id('bill')} rows={2} value={f.billing_address ?? ''} onChange={(ev) => set('billing_address', ev.target.value)} placeholder="Building, street, area" />
          </Field>
          <Field label="City" htmlFor={id('city')}>
            <Input id={id('city')} value={f.city ?? ''} onChange={(ev) => set('city', ev.target.value)} />
          </Field>
          {india ? (
            <Field label="State" htmlFor={id('state')} error={e('state') ?? e('state_code')} hint="Place of supply on invoices.">
              <Select id={id('state')} value={f.state_code ?? ''} onChange={(ev) => onChange({ ...f, state_code: ev.target.value, state: stateName(ev.target.value) })} options={STATE_OPTIONS} />
            </Field>
          ) : (
            <Field label="State / region" htmlFor={id('state')}>
              <Input id={id('state')} value={f.state ?? ''} onChange={(ev) => set('state', ev.target.value)} />
            </Field>
          )}
          <Field label={india ? 'PIN code' : 'Postal code'} htmlFor={id('pin')} error={e('pincode')}>
            <Input id={id('pin')} value={f.pincode ?? ''} maxLength={india ? 6 : 12} inputMode={india ? 'numeric' : undefined} invalid={!!e('pincode')} onChange={(ev) => set('pincode', ev.target.value)} className="tnum" />
          </Field>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[14px] font-semibold">Registered address</h4>
          <Checkbox checked={same} onChange={(v) => set('registered_address', { ...ra, same_as_billing: v })} label="Same as billing address" />
        </div>
        {!same && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Address" htmlFor={id('reg')} className="sm:col-span-3">
              <Textarea id={id('reg')} rows={2} value={ra.line ?? ''} onChange={(ev) => set('registered_address', { ...ra, line: ev.target.value })} />
            </Field>
            <Field label="City" htmlFor={id('rcity')}>
              <Input id={id('rcity')} value={ra.city ?? ''} onChange={(ev) => set('registered_address', { ...ra, city: ev.target.value })} />
            </Field>
            {india ? (
              <Field label="State" htmlFor={id('rstate')} error={e('registered_address.state')}>
                <Select id={id('rstate')} value={ra.state_code ?? ''} onChange={(ev) => set('registered_address', { ...ra, state_code: ev.target.value, state: stateName(ev.target.value) })} options={STATE_OPTIONS} />
              </Field>
            ) : (
              <Field label="State / region" htmlFor={id('rstate')}>
                <Input id={id('rstate')} value={ra.state ?? ''} onChange={(ev) => set('registered_address', { ...ra, state: ev.target.value })} />
              </Field>
            )}
            <Field label={india ? 'PIN code' : 'Postal code'} htmlFor={id('rpin')} error={e('registered_address.pincode')}>
              <Input id={id('rpin')} value={ra.pincode ?? ''} maxLength={india ? 6 : 12} onChange={(ev) => set('registered_address', { ...ra, pincode: ev.target.value })} className="tnum" />
            </Field>
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-[14px] font-semibold">Contacts</h4>
        {contacts.length === 0 && <p className="mb-2 text-[12.5px] text-ink-3">Add the people you deal with. The first one is the primary contact.</p>}
        <ul className="space-y-3">
          {contacts.map((c, i) => (
            <li key={i} className="rounded-lg border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]">
                <Field label="Name" required error={e(`contacts.${i}.name`)} htmlFor={id(`cn${i}`)}>
                  <Input id={id(`cn${i}`)} value={c.name} invalid={!!e(`contacts.${i}.name`)} onChange={(ev) => setContact(i, { name: ev.target.value })} />
                </Field>
                <Field label="Role" htmlFor={id(`cr${i}`)}>
                  <Input id={id(`cr${i}`)} value={c.role} onChange={(ev) => setContact(i, { role: ev.target.value })} placeholder="e.g. Finance head" />
                </Field>
                <div className="flex items-start justify-end sm:pt-6">
                  <IconButton label={`Remove contact ${i + 1}`} size="sm" onClick={() => set('contacts', contacts.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </IconButton>
                </div>
                <Field label="E-mail" error={e(`contacts.${i}.email`)} htmlFor={id(`ce${i}`)}>
                  <Input id={id(`ce${i}`)} type="email" value={c.email} invalid={!!e(`contacts.${i}.email`)} onChange={(ev) => setContact(i, { email: ev.target.value })} />
                </Field>
                <Field label="Phone" htmlFor={id(`cp${i}`)}>
                  <Input id={id(`cp${i}`)} inputMode="tel" value={c.phone} onChange={(ev) => setContact(i, { phone: ev.target.value })} />
                </Field>
                <div className="flex items-end sm:pb-2">
                  <Checkbox checked={c.primary} onChange={(v) => setContact(i, { primary: v })} label="Primary" />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => set('contacts', [...contacts, { name: '', role: '', email: '', phone: '', primary: contacts.length === 0 }])}>
          Add contact
        </Button>
      </section>

      {showPayments && (
        <section className="rounded-lg border border-line">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
            aria-expanded={payOpen}
            onClick={() => {
              if (!payOpen && !pp) set('payments_profile', { bank_name: '', account_name: '', account_no: '', ifsc: '', upi: '', payment_terms_days: f.payment_terms_days ?? 30, billing_email: '' })
              setPayOpen(!payOpen)
            }}
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">Payments profile</span>
              <span className="block text-[12.5px] text-ink-3">Optional — the customer’s bank, UPI, payment terms and billing e-mail.</span>
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', payOpen && 'rotate-180')} />
          </button>
          {payOpen && pp && (
            <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-2">
              <Field label="Bank name" htmlFor={id('bank')}>
                <Input id={id('bank')} value={pp.bank_name ?? ''} onChange={(ev) => set('payments_profile', { ...pp, bank_name: ev.target.value })} />
              </Field>
              <Field label="Account name" htmlFor={id('accname')}>
                <Input id={id('accname')} value={pp.account_name ?? ''} onChange={(ev) => set('payments_profile', { ...pp, account_name: ev.target.value })} />
              </Field>
              <Field label="Account number" htmlFor={id('accno')} error={e('payments_profile.account_no')} hint={!canSeePayments && pp.account_no ? 'Masked. Type a new number to replace it.' : undefined}>
                <Input id={id('accno')} value={pp.account_no ?? ''} inputMode="numeric" invalid={!!e('payments_profile.account_no')} onChange={(ev) => set('payments_profile', { ...pp, account_no: ev.target.value })} className="tnum" />
              </Field>
              <Field label="IFSC" htmlFor={id('ifsc')} error={e('payments_profile.ifsc')}>
                <Input id={id('ifsc')} value={pp.ifsc ?? ''} maxLength={11} invalid={!!e('payments_profile.ifsc')} onChange={(ev) => set('payments_profile', { ...pp, ifsc: ev.target.value.toUpperCase() })} className="tnum uppercase" />
              </Field>
              <Field label="UPI ID" htmlFor={id('upi')} error={e('payments_profile.upi')}>
                <Input id={id('upi')} value={pp.upi ?? ''} invalid={!!e('payments_profile.upi')} onChange={(ev) => set('payments_profile', { ...pp, upi: ev.target.value })} placeholder="name@bank" />
              </Field>
              <Field label="Billing e-mail" htmlFor={id('bem')} error={e('payments_profile.billing_email')}>
                <Input id={id('bem')} type="email" value={pp.billing_email ?? ''} invalid={!!e('payments_profile.billing_email')} onChange={(ev) => set('payments_profile', { ...pp, billing_email: ev.target.value })} placeholder="accounts@customer.com" />
              </Field>
              <div className="sm:col-span-2">
                <Button size="sm" variant="ghost" onClick={() => { set('payments_profile', null); setPayOpen(false) }}>Remove payments profile</Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
