// /careers/:token — the public job page of one opening (v9, decision D7). No sign-in, rendered outside the app shell,
// branded with the company's name and logo. Shows the job description and an application form; when the opening no
// longer takes applications the page says so and shows no form (the API refuses the POST as well).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { careersApi, EMPLOYMENT_TYPE, WORK_MODE, type Application, type PublicOpening } from '@/api/recruiting'
import type { ApiError } from '@/api/http'
import { applyTheme } from '@/theme/theme'
import { DEFAULT_THEME } from '@/domain/defaults'
import { fmtDate } from '@/domain/calendar'
import { fmtMoneyCompact } from '@/domain/money'
import { Briefcase, CheckCircle2, Clock, MapPin, Paperclip, X } from '@/ui/icons'
import { Button, Callout, Checkbox, Field, Input, MoneyInput, Select, Skeleton, Textarea, TenantMark } from '@/ui'
import { cn } from '@/lib/utils'

const NOTICE = [
  { value: '0', label: 'Immediately available' },
  { value: '15', label: '15 days' },
  { value: '30', label: '30 days' },
  { value: '45', label: '45 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]
const blank = (): Application => ({
  name: '', email: '', phone: '', linkedin_url: '', current_company: '', current_title: '', experience_years: '', notice_days: '', expected_ctc_paise: null, location: '', cover_note: '', consent: false, resume: null, website: '',
})

export default function CareersPage() {
  const { token = '' } = useParams()
  const q = useQuery({ queryKey: ['careers', token], queryFn: () => careersApi.get(token), retry: false, refetchOnWindowFocus: false })
  const d = q.data
  useEffect(() => {
    applyTheme({ ...DEFAULT_THEME, primary: d?.company.primary || DEFAULT_THEME.primary, mode: 'light' })
  }, [d?.company.primary])
  useEffect(() => {
    document.title = d ? `${d.opening.role} · ${d.company.name}` : 'Job opening'
  }, [d])

  return (
    <div className="min-h-full bg-bg text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          {d ? (
            <>
              <TenantMark name={d.company.name} logo={d.company.logo_data_url} size={34} />
              <span className="min-w-0 truncate text-[15px] font-semibold">{d.company.name}</span>
              <span className="ml-auto hidden text-[13px] text-ink-3 sm:inline">Careers</span>
            </>
          ) : (
            <Skeleton className="h-8 w-40" />
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
        {q.isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading the job">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-40" />
          </div>
        ) : q.error ? (
          <div className="mx-auto max-w-[560px] py-12">
            <Callout tone={(q.error as ApiError).status === 404 ? 'neutral' : 'danger'} title={(q.error as ApiError).status === 404 ? 'Job not found' : 'The job could not be loaded'}>
              {(q.error as ApiError).message}
            </Callout>
            {(q.error as ApiError).status !== 404 && (
              <Button className="mt-4" onClick={() => q.refetch()}>
                Try again
              </Button>
            )}
          </div>
        ) : d ? (
          <Job d={d} token={token} />
        ) : null}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 text-[12.5px] text-ink-3 sm:px-6">
          <span>{d ? `© ${new Date().getFullYear()} ${d.company.name}` : ''}</span>
          <a href="/privacy" className="hover:text-ink-2 hover:underline">
            Privacy
          </a>
          <span className="ml-auto">Hiring with SeereonOS</span>
        </div>
      </footer>
    </div>
  )
}

function Job({ d, token }: { d: PublicOpening; token: string }) {
  const o = d.opening
  const exp = o.experience_min !== null || o.experience_max !== null ? (o.experience_min !== null && o.experience_max !== null ? `${o.experience_min}–${o.experience_max} years` : o.experience_min !== null ? `${o.experience_min}+ years` : `Up to ${o.experience_max} years`) : null
  const salary = o.salary_min_paise !== null || o.salary_max_paise !== null ? [o.salary_min_paise, o.salary_max_paise].filter((x): x is number => x !== null).map((x) => fmtMoneyCompact(x)).join(' – ') + ' a year' : null
  type Fact = { icon?: ReactNode; label: string; value: string }
  const facts = ([
    o.location ? { icon: <MapPin className="size-4" />, label: 'Location', value: o.location } : null,
    o.work_mode ? { label: 'Work mode', value: WORK_MODE[o.work_mode] } : null,
    o.employment_type ? { icon: <Briefcase className="size-4" />, label: 'Employment', value: EMPLOYMENT_TYPE[o.employment_type] } : null,
    exp ? { icon: <Clock className="size-4" />, label: 'Experience', value: exp } : null,
    salary ? { label: 'Salary', value: salary } : null,
  ] as (Fact | null)[]).filter((x): x is Fact => !!x)
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
      <article className="min-w-0">
        <p className="text-[13px] text-ink-3">
          {d.company.name} · posted {fmtDate(o.posted_on)}
          {o.count > 1 ? ` · ${o.count} positions` : ''}
        </p>
        <h1 className="mt-1 break-words text-[26px] font-semibold leading-tight sm:text-[30px]">{o.role}</h1>
        {facts.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {facts.map((f) => (
              <div key={f.label} className="flex min-w-0 items-center gap-1.5">
                {f.icon && <span className="text-ink-3" aria-hidden>{f.icon}</span>}
                <dt className="sr-only">{f.label}</dt>
                <dd className="text-ink-2">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {d.accepting && (
          <a href="#apply" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand px-5 text-[15px] font-medium text-brand-ink lg:hidden">
            Apply now
          </a>
        )}
        {!d.accepting && <ClosedNote d={d} className="mt-5" />}
        <div className="mt-8 space-y-8">
          {o.about && (
            <Section title="About the role">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{o.about}</p>
            </Section>
          )}
          <Bullets title="Responsibilities" items={o.responsibilities} />
          <Bullets title="Requirements" items={o.requirements} />
          <Bullets title="Nice to have" items={o.nice_to_have} />
          {!o.about && !o.responsibilities.length && !o.requirements.length && <p className="text-[15px] text-ink-2">The full description will be shared with shortlisted candidates.</p>}
        </div>
      </article>
      <aside id="apply" className="mt-10 scroll-mt-4 lg:mt-0">
        <div className="lg:sticky lg:top-6">{d.accepting ? <ApplyForm d={d} token={token} /> : <ClosedNote d={d} />}</div>
      </aside>
    </div>
  )
}

function ClosedNote({ d, className }: { d: PublicOpening; className?: string }) {
  return (
    <Callout tone="neutral" className={className} title="This opening is no longer accepting applications">
      {d.closed_reason === 'filled' ? 'The position has been filled.' : d.closed_reason === 'paused' ? 'Hiring for this role is paused.' : 'Applications for this role are closed.'} Thank you for your interest in {d.company.name}.
    </Callout>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}
function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <Section title={title}>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2 marker:text-ink-3">
        {items.map((x, i) => (
          <li key={i} className="break-words pl-1">
            {x}
          </li>
        ))}
      </ul>
    </Section>
  )
}

const ORDER: (keyof Application)[] = ['name', 'email', 'phone', 'location', 'linkedin_url', 'current_company', 'current_title', 'experience_years', 'notice_days', 'expected_ctc_paise', 'resume', 'cover_note', 'consent']

function ApplyForm({ d, token }: { d: PublicOpening; token: string }) {
  const [f, setF] = useState<Application>(blank)
  const [errs, setErrs] = useState<Partial<Record<keyof Application | 'form', string>>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [reading, setReading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const set = <K extends keyof Application>(k: K, v: Application[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrs((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }
  const maxMb = d.max_resume_mb
  const focusFirst = (e: Partial<Record<string, string>>) => {
    const k = ORDER.find((x) => e[x])
    if (k) setTimeout(() => (formRef.current?.querySelector(`[data-field="${k}"] input, [data-field="${k}"] textarea, [data-field="${k}"] select, [data-field="${k}"] button`) as HTMLElement | null)?.focus(), 0)
  }
  const validate = () => {
    const e: Partial<Record<keyof Application, string>> = {}
    if (f.name.trim().length < 2) e.name = 'Enter your full name.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
    if (f.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter your phone number.'
    if (f.location.trim().length < 2) e.location = 'Tell us where you are based.'
    if (f.linkedin_url.trim() && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(f.linkedin_url.trim())) e.linkedin_url = 'Paste the link to your LinkedIn profile (https://www.linkedin.com/in/…).'
    if (f.experience_years === '' || Number(f.experience_years) < 0 || Number(f.experience_years) > 50) e.experience_years = 'Experience is between 0 and 50 years.'
    if (f.notice_days === '') e.notice_days = 'Choose your notice period.'
    if (!f.resume) e.resume = 'Attach your resume (PDF, DOC or DOCX).'
    if (!f.consent) e.consent = 'Please agree so we can use your details for this application.'
    return e
  }
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrs(e)
    if (Object.keys(e).length) return focusFirst(e)
    setBusy(true)
    try {
      await careersApi.apply(token, { ...f, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), location: f.location.trim(), linkedin_url: f.linkedin_url.trim() })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (x) {
      const err = x as ApiError
      const next = err.field ? { [err.field]: err.message } : { form: err.message }
      setErrs(next)
      focusFirst(next)
    } finally {
      setBusy(false)
    }
  }
  const pick = (file: File | undefined) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'doc', 'docx'].includes(ext)) return setErrs((e) => ({ ...e, resume: 'Upload your resume as a PDF, DOC or DOCX file.' }))
    if (file.size > maxMb * 1024 * 1024) return setErrs((e) => ({ ...e, resume: `The file is larger than ${maxMb} MB. Save a smaller PDF and try again.` }))
    setReading(true)
    const r = new FileReader()
    r.onload = () => {
      setReading(false)
      set('resume', { name: file.name, mime: file.type || 'application/octet-stream', size_bytes: file.size, data_url: String(r.result) })
    }
    r.onerror = () => {
      setReading(false)
      setErrs((e) => ({ ...e, resume: 'The file could not be read. Choose it again.' }))
    }
    r.readAsDataURL(file)
  }

  if (done)
    return (
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6" role="status" aria-live="polite">
        <CheckCircle2 className="size-7 text-success-text" aria-hidden />
        <h2 className="mt-3 text-[18px] font-semibold">Application received</h2>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">
          Thank you, {f.name.trim().split(' ')[0]}. Your application for {d.opening.role} has reached the hiring team at {d.company.name}. They will contact you at {f.email.trim()} if your profile is a match.
        </p>
      </div>
    )

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="relative rounded-lg border border-line bg-surface p-4 sm:p-6" aria-labelledby="apply-title">
      <h2 id="apply-title" className="text-[18px] font-semibold">
        Apply for this role
      </h2>
      <p className="mt-1 text-[13px] text-ink-3">Fields marked * are required.</p>
      <div className="mt-5 grid gap-4">
        <F k="name" label="Full name" required errs={errs}>
          <Input id="ap-name" autoComplete="name" value={f.name} invalid={!!errs.name} onChange={(e) => set('name', e.target.value)} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <F k="email" label="Email" required errs={errs}>
            <Input id="ap-email" type="email" inputMode="email" autoComplete="email" value={f.email} invalid={!!errs.email} onChange={(e) => set('email', e.target.value)} />
          </F>
          <F k="phone" label="Phone" required errs={errs}>
            <Input id="ap-phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} invalid={!!errs.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </F>
        </div>
        <F k="location" label="Current location" required errs={errs}>
          <Input id="ap-location" autoComplete="address-level2" value={f.location} invalid={!!errs.location} onChange={(e) => set('location', e.target.value)} placeholder="City" />
        </F>
        <F k="linkedin_url" label="LinkedIn profile" errs={errs}>
          <Input id="ap-linkedin_url" type="url" inputMode="url" value={f.linkedin_url} invalid={!!errs.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://www.linkedin.com/in/your-name" />
        </F>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <F k="current_company" label="Current company" errs={errs}>
            <Input id="ap-current_company" autoComplete="organization" value={f.current_company} onChange={(e) => set('current_company', e.target.value)} />
          </F>
          <F k="current_title" label="Current title" errs={errs}>
            <Input id="ap-current_title" autoComplete="organization-title" value={f.current_title} onChange={(e) => set('current_title', e.target.value)} />
          </F>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <F k="experience_years" label="Total experience (years)" required errs={errs}>
            <Input id="ap-experience_years" type="number" inputMode="decimal" min={0} max={50} step={0.5} value={f.experience_years} invalid={!!errs.experience_years} onChange={(e) => set('experience_years', e.target.value === '' ? '' : Number(e.target.value))} />
          </F>
          <F k="notice_days" label="Notice period" required errs={errs}>
            <Select id="ap-notice_days" value={f.notice_days === '' ? '' : String(f.notice_days)} invalid={!!errs.notice_days} placeholder="Choose" onChange={(e) => set('notice_days', e.target.value === '' ? '' : Number(e.target.value))} options={NOTICE} />
          </F>
        </div>
        <F k="expected_ctc_paise" label="Expected CTC per year" hint="Optional" errs={errs}>
          <MoneyInput id="ap-expected_ctc_paise" value={f.expected_ctc_paise} invalid={!!errs.expected_ctc_paise} onChange={(v) => set('expected_ctc_paise', v || null)} />
        </F>
        <F k="resume" label="Resume" required hint={`PDF, DOC or DOCX, up to ${maxMb} MB`} errs={errs}>
          {f.resume ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5">
              <Paperclip className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14px]">{f.resume.name}</span>
              <span className="tnum shrink-0 text-[12.5px] text-ink-3">{Math.max(1, Math.round(f.resume.size_bytes / 1024))} KB</span>
              <button type="button" onClick={() => set('resume', null)} className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-ink" aria-label="Remove the resume">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                pick(e.dataTransfer.files?.[0])
              }}
              className={cn('flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-3 text-center text-[14px] transition hover:bg-surface-2 focus-within:ring-2 focus-within:ring-ring', errs.resume ? 'border-danger' : 'border-line-strong')}>
              <span className="font-medium text-brand-text">{reading ? 'Reading the file…' : 'Choose a file'}</span>
              <span className="text-[12.5px] text-ink-3">or drop it here</span>
              <input id="ap-resume" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-invalid={!!errs.resume || undefined} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}
        </F>
        <F k="cover_note" label="Cover note" hint="Optional — why this role, and anything we should know." errs={errs}>
          <Textarea id="ap-cover_note" rows={4} maxLength={3000} value={f.cover_note} onChange={(e) => set('cover_note', e.target.value)} />
        </F>
        {/* honeypot: hidden from people and screen readers; bots fill every field */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="ap-website">Website</label>
          <input id="ap-website" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
        </div>
        <div data-field="consent">
          <Checkbox checked={f.consent} onChange={(v) => set('consent', v)} label={`I agree that ${d.company.name} may store and use these details to assess my application.`} />
          {errs.consent && <p className="mt-1.5 text-[12.5px] font-medium text-danger-text">{errs.consent}</p>}
        </div>
        {errs.form && <Callout tone="danger">{errs.form}</Callout>}
        <Button type="submit" variant="primary" loading={busy} disabled={reading} className="h-11 w-full text-[15px]">
          Submit application
        </Button>
      </div>
    </form>
  )
}

function F({ k, label, required, hint, errs, children }: { k: keyof Application; label: string; required?: boolean; hint?: string; errs: Partial<Record<string, string>>; children: ReactNode }) {
  return (
    <div data-field={k}>
      <Field label={label} htmlFor={`ap-${k}`} required={required} hint={hint} error={errs[k]}>
        {children}
      </Field>
    </div>
  )
}
