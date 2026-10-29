// /projects/new — the New Project wizard (v9 items 1 + 2, decisions D1–D3). Seven steps: customer → project & client
// details → resource allocation → commercials → milestones & WBS (optional) → escalation matrix → overview. Steps are
// a vertical list on desktop and a compact stepper on phones; Back / Next keep everything typed; each Next asks the
// server to validate that step (POST /projects/wizard/preview) and the final Create is ONE server call
// (POST /projects/wizard) that creates the customer, project, milestones, tasks, allocations, costing plan and
// escalation matrix together. Ctrl/⌘ + Enter = Next.
//   ?customer=<id>  start with that customer picked (customer page › New project)
//   ?estimate=<id>  convert a cost-calculator estimate (prefilled: customer, dates, resources, commercials, milestones)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Rocket } from '@/ui/icons'
import { ApiError } from '@/api/http'
import { useApi, useMut } from '@/api/query'
import { wizardApi, useCustomerOptions, type WizardPreview, type WizardStep } from '@/api/projectWizard'
import { estimatesApi } from '@/api/estimates'
import { useSession } from '@/stores/session'
import { readFileAsDataURL, cn } from '@/lib/utils'
import { Button, Callout, Card, PageHeader, toast, useCan, useReadOnly, useUnsavedChanges } from '@/ui'
import { blankWizard, STEPS, stepOfField, toInput, validateEscRows, type StepKey, type WizardDraft } from './wizardDraft'
import { prefillFromEstimate } from './prefill'
import { CustomerStep, DetailsStep, ResourcesStep, CommercialsStep, MilestonesStep, EscalationStep } from './WizardSteps'
import { OverviewStep } from './OverviewStep'

const ORDER = STEPS.map((s) => s.key)

function useDebounced<T>(v: T, ms: number): T {
  const [x, setX] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return x
}

export default function NewProjectWizard() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { user } = useSession()
  const can = useCan()
  const readOnly = useReadOnly()
  const manageAll = can('projects.manage_all')
  // the server makes the creator the PM when none is chosen (if they can manage projects): show that up front
  const defaultPm = manageAll && !can('projects.edit') ? null : user?.id ?? null
  const [d, setD] = useState<WizardDraft>(() => blankWizard(defaultPm))
  const [step, setStep] = useState<StepKey>('customer')
  const [visited, setVisited] = useState<Set<StepKey>>(() => new Set(['customer']))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [created, setCreated] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const customers = useCustomerOptions()

  // ---------------- prefill (?customer=, ?estimate=) ----------------
  const customerParam = sp.get('customer')
  const estimateParam = sp.get('estimate')
  useEffect(() => {
    if (customerParam) setD((x) => ({ ...x, customer: { ...x.customer, mode: 'existing', client_id: customerParam } }))
  }, [customerParam])
  const est = useApi(['estimate', estimateParam], () => estimatesApi.get(estimateParam!), { enabled: !!estimateParam })
  const prefilled = useRef(false)
  useEffect(() => {
    if (!est.data || prefilled.current) return
    prefilled.current = true
    setD((x) => prefillFromEstimate(x, est.data!, customers.data?.items ?? [], defaultPm))
  }, [est.data, customers.data, defaultPm])

  const update = useCallback((fn: (x: WizardDraft) => WizardDraft) => {
    setD(fn)
    setDirty(true)
    setBanner(null)
  }, [])
  const clearErrors = useCallback((prefix: string) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(prefix)))), [])

  // ---------------- live server preview (numbers + step states) ----------------
  const input = useMemo(() => toInput(d), [d])
  const raw = useMemo(() => JSON.stringify(input), [input])
  const key = useDebounced(raw, 300)
  const live = useApi(['wizard-preview', key], () => wizardApi.preview(JSON.parse(key)), { placeholderData: keepPreviousData, staleTime: 30_000, retry: false, enabled: !readOnly })
  const pv: WizardPreview | undefined = live.data

  const goto = (k: StepKey) => {
    setStep(k)
    setVisited((v) => new Set([...v, k]))
    setBanner(null)
    requestAnimationFrame(() => {
      headingRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
  const showError = (field: string | null, message: string) => {
    if (field) setErrors((e) => ({ ...e, [field]: message }))
    setBanner(message)
  }

  /** Validate the current step on the server, then move on. */
  const next = async () => {
    if (step === 'overview') return
    if (step === 'milestones' && d.milestonesSkipped) return goto(ORDER[ORDER.indexOf(step) + 1])
    if (step === 'escalation') {
      // V9-FIX (item 10): the server's row rules first, client side
      const local = Object.entries(validateEscRows(d.escalation.rows, d.escalation.notes))
      if (local.length) {
        setErrors((e) => ({ ...e, ...Object.fromEntries(local.map(([k, v]) => [`escalation.${k}`, v])) }))
        setBanner(local[0][1])
        return
      }
    }
    setChecking(true)
    try {
      const r = await wizardApi.preview(toInput(d, step as WizardStep))
      const bad = (Object.keys(r.steps) as WizardStep[]).find((s) => r.steps[s].ok === false)
      if (bad) {
        const e = r.steps[bad].error!
        if (bad !== step) goto(bad)
        showError(e.field, e.message)
        return
      }
      clearErrors(step === 'commercials' ? 'additional_costs' : step)
      if (step === 'commercials') clearErrors('costing')
      goto(ORDER[ORDER.indexOf(step) + 1])
    } catch (e) {
      const err = e as ApiError
      setBanner(err.message || 'Could not check this step. Try again.')
    } finally {
      setChecking(false)
    }
  }
  const back = () => {
    const i = ORDER.indexOf(step)
    if (i > 0) goto(ORDER[i - 1])
  }
  const canJump = (k: StepKey) => visited.has(k) || ORDER.indexOf(k) <= ORDER.indexOf(step)

  // ---------------- create (one call) ----------------
  const create = useMut(
    async () => {
      const documents = await Promise.all(d.docs.map(async (f) => ({ name: f.name, mime: f.type, size_bytes: f.size, data_url: await readFileAsDataURL(f) })))
      const body = toInput(d)
      return wizardApi.create({ ...body, details: { ...body.details, documents } })
    },
    {
      invalidate: [['projects'], ['clients'], ['customers'], ['estimates'], ['margins']],
      success: (r) => (r.duplicate ? `${r.project.code} was already created` : `${r.project.code} created`),
      silentError: true,
      onSuccess: (r) => {
        setCreated(true)
        release()
        nav(`/projects/${r.project.id}`)
      },
      onError: (e) => {
        const s = stepOfField(e.field)
        if (e.field) goto(s)
        showError(e.field ?? null, e.message)
        toast.error(e.message)
      },
    },
  )
  const { release } = useUnsavedChanges(dirty && !created, { title: 'Leave the new project?', body: 'Nothing has been created yet. If you leave now, what you typed in the wizard is lost.' })

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (step === 'overview') create.mutate(undefined)
        else void next()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const idx = ORDER.indexOf(step)
  const meta = STEPS[idx]
  const stateOf = (k: StepKey): 'done' | 'error' | 'current' | 'todo' => {
    if (k === step) return 'current'
    if (k === 'overview') return 'todo'
    const s = pv?.steps[k as WizardStep]
    if (visited.has(k) && s?.ok === false) return 'error'
    if (visited.has(k) && ORDER.indexOf(k) < idx) return 'done'
    return 'todo'
  }
  const stepProps = { d, update, errors, clearErrors, pv, loading: live.isFetching, customers: customers.data, goto }

  if (readOnly)
    return (
      <div>
        <PageHeader title="New project" back={{ to: '/projects', label: 'Projects' }} />
        <Callout tone="info">You are viewing as another role (read-only), so projects can’t be created here.</Callout>
      </div>
    )

  return (
    <div className="pb-36 lg:pb-0">
      <PageHeader
        title="New project"
        subtitle={pv ? `Project code ${pv.next_code} is assigned when you create it. New projects start as Initiated.` : 'Customer, details, people, commercials, milestones and escalation — created in one go.'}
        back={{ to: '/projects', label: 'Projects' }}
      />
      {estimateParam && est.data && (
        <Callout tone="info" className="mb-4" title={`From estimate ${est.data.estimate.number ?? ''}`}>
          Filled in from the cost calculator. Role placeholders become resource rows without a person — choose who does the work. Creating the project marks the estimate converted.
        </Callout>
      )}

      {/* phones / tablets: compact stepper */}
      <nav aria-label="Wizard steps" className="mb-4 lg:hidden">
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="font-medium text-ink">Step {idx + 1} of {STEPS.length}</span>
          <span className="min-w-0 truncate text-ink-3">{meta.label}</span>
        </div>
        <ol className="mt-2 grid grid-cols-7 gap-1">
          {STEPS.map((s, i) => {
            const st = stateOf(s.key)
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-label={`${i + 1}. ${s.label}${st === 'error' ? ' (needs attention)' : st === 'done' ? ' (done)' : ''}`}
                  aria-current={st === 'current' ? 'step' : undefined}
                  disabled={!canJump(s.key)}
                  onClick={() => goto(s.key)}
                  className="flex h-10 w-full items-center justify-center"
                >
                  <span className={cn('block h-1.5 w-full rounded-full', st === 'current' ? 'bg-brand' : st === 'done' ? 'bg-brand/45' : st === 'error' ? 'bg-danger' : 'bg-line-strong')} />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)]">
        {/* desktop: steps as a vertical list */}
        <nav aria-label="Wizard steps" className="hidden lg:block">
          <ol className="sticky top-4 space-y-0.5 rounded-lg border border-line bg-surface p-2">
            {STEPS.map((s, i) => {
              const st = stateOf(s.key)
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!canJump(s.key)}
                    aria-current={st === 'current' ? 'step' : undefined}
                    onClick={() => goto(s.key)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55',
                      st === 'current' ? 'bg-brand-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'tnum mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold',
                        st === 'current' && 'border-brand bg-brand text-brand-ink',
                        st === 'done' && 'border-brand text-brand-text',
                        st === 'error' && 'border-danger text-danger-text',
                        st === 'todo' && 'border-line-strong text-ink-3',
                      )}
                    >
                      {st === 'done' ? <Check className="size-3.5" /> : st === 'error' ? '!' : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-[13.5px] leading-snug', st === 'current' ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{s.label}</span>
                      <span className={cn('block text-[12px] leading-snug', st === 'error' ? 'text-danger-text' : 'text-ink-3')}>{st === 'error' ? 'Needs attention' : s.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <Card className="min-w-0">
          <div className="mb-4">
            <h2 ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-ink outline-none">
              {idx + 1}. {meta.label}
            </h2>
            <p className="text-[12.5px] text-ink-3">{meta.hint}</p>
          </div>
          {banner && (
            <Callout tone="danger" icon={<AlertTriangle />} className="mb-4" >
              <span role="alert">{banner}</span>
            </Callout>
          )}
          {step === 'customer' && <CustomerStep {...stepProps} />}
          {step === 'details' && <DetailsStep {...stepProps} />}
          {step === 'resources' && <ResourcesStep {...stepProps} />}
          {step === 'commercials' && <CommercialsStep {...stepProps} />}
          {step === 'milestones' && <MilestonesStep {...stepProps} onSkip={() => { update((x) => ({ ...x, milestonesSkipped: true })); goto('escalation') }} />}
          {step === 'escalation' && <EscalationStep {...stepProps} />}
          {step === 'overview' && <OverviewStep {...stepProps} />}

          {/* actions: inline on desktop, sticky bar above the tab bar on phones */}
          <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-line bg-surface px-4 py-2.5 lg:static lg:z-auto lg:mt-6 lg:justify-between lg:border-t lg:px-0 lg:pb-0 lg:pt-4">
            <Button className="flex-1 lg:flex-none" icon={<ArrowLeft className="size-4" />} disabled={idx === 0} onClick={back}>
              Back
            </Button>
            {step === 'overview' ? (
              <Button className="flex-[2] lg:flex-none" variant="primary" icon={<Rocket className="size-4" />} loading={create.isPending} onClick={() => create.mutate(undefined)}>
                Create project
              </Button>
            ) : (
              <Button className="flex-[2] lg:flex-none" variant="primary" loading={checking} onClick={() => void next()} title="Ctrl + Enter">
                <span className="inline-flex items-center gap-1.5">
                  {step === 'escalation' ? 'Review' : 'Next'}
                  <ArrowRight className="size-4" />
                </span>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
