// v9 (D9) report types: /reports/types/:type (builder) → /reports/types/:type/result?c=… (result: KPI summary, chart,
// detail table with totals, PDF / Excel / CSV, save as a named report). Saved typed reports open at /reports/:id
// (TypedSavedView) and edit at /reports/:id/edit (TypedSavedEdit). The configuration travels in the URL so a result
// survives a reload; the server validates it and computes every number.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, MoreHorizontal, Pencil, Play, Save } from '@/ui/icons'
import { decodeConfig, encodeConfig, reportTypesApi, useReportType } from '@/api/reportTypes'
import { reportsApi, type SavedReportView } from '@/api/reports'
import { useApi, useMut } from '@/api/query'
import type { ReportTypeConfig, ReportTypeDef } from '@/api/types/viz'
import { Badge, Button, Dialog, ErrorState, Field, IconButton, Input, Menu, PageHeader, Select, SkeletonCards, SkeletonRows, Switch, Textarea, useCan, useConfirm, useReadOnly } from '@/ui'
import { ExportMenu } from '@/reports/ExportMenu'
import { PRESET_LABEL } from '@/reports/datasets'
import { defaultConfig, TypeBuilder, validateConfig, type BuilderErrors } from './types/TypeBuilder'
import { toTypedExport, TypeResult } from './types/TypeResult'

const CATEGORY_LABEL: Record<string, string> = { financial: 'Financial', attendance: 'Attendance', salary: 'Salary', task: 'Task', project: 'Project', timesheet: 'Timesheet' }

function useTypedRun(type: string | undefined, cfg: ReportTypeConfig | null, savedId?: string) {
  return useApi(['report-types', 'run', type, savedId ?? '', JSON.stringify(cfg)], () => (savedId ? reportTypesApi.runSaved(savedId, cfg ?? undefined) : reportTypesApi.run(type!, cfg ?? {})), {
    enabled: !!type && !!cfg,
    placeholderData: (p) => p,
    retry: false,
  })
}

/* ------------------------------------------------------------------ save dialog */
function SaveTypedDialog({ open, onOpenChange, def, config, existing }: { open: boolean; onOpenChange: (o: boolean) => void; def: ReportTypeDef; config: ReportTypeConfig; existing?: SavedReportView | null }) {
  const nav = useNavigate()
  const readOnly = useReadOnly()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setName(existing?.name ?? def.label)
    setDescription(existing?.description ?? '')
    setShared(existing?.shared ?? false)
    setError(null)
  }, [open, existing, def.label])
  const save = useMut(
    () => (existing?.can_edit ? reportTypesApi.update(existing.id, { name: name.trim(), description: description.trim(), config, shared }, existing.version) : reportTypesApi.save({ name: name.trim(), description: description.trim(), report_type: def.id, config, shared })),
    {
      invalidate: [['reports']],
      success: existing?.can_edit ? 'Report updated' : 'Report saved',
      onSuccess: (r) => {
        onOpenChange(false)
        nav(`/reports/${r.id}`)
      },
      onError: (e) => e.field === 'name' && setError(e.message),
    },
  )
  const submit = () => {
    if (name.trim().length < 2) return setError('Give the report a name of at least 2 characters.')
    save.mutate(undefined)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing?.can_edit ? 'Save changes' : 'Save report'}
      description="A saved report keeps these fields, filters, grouping and chart, and re-runs on live data every time it is opened."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={readOnly} onClick={submit}>
            {existing?.can_edit ? 'Save changes' : 'Save report'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={error} htmlFor="rt-save-name">
          <Input id="rt-save-name" value={name} onChange={(e) => (setName(e.target.value), setError(null))} maxLength={120} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} invalid={!!error} />
        </Field>
        <Field label="Description" hint="Shown on the report card. Optional." htmlFor="rt-save-desc">
          <Textarea id="rt-save-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} rows={2} />
        </Field>
        <div className="rounded-lg border border-line p-3">
          <Switch checked={shared} onChange={setShared} label="Share with the team" description="Colleagues who may run this report type see it under Shared. Each of them sees only the data their role allows." />
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ builder */
function BuilderScreen({ def, initial, onRun, title, back, saveAction }: { def: ReportTypeDef; initial: ReportTypeConfig; onRun: (c: ReportTypeConfig) => void; title: string; back: { to: string; label: string }; saveAction?: (c: ReportTypeConfig) => React.ReactNode }) {
  const [cfg, setCfg] = useState<ReportTypeConfig>(initial)
  const [errors, setErrors] = useState<BuilderErrors>({})
  const run = () => {
    const e = validateConfig(def, cfg)
    setErrors(e)
    if (Object.keys(e).length) return
    onRun(cfg)
  }
  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        back={back}
        title={title}
        subtitle={def.description}
        meta={<Badge size="sm" tone="neutral">{CATEGORY_LABEL[def.category]} report</Badge>}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            {saveAction?.(cfg)}
            <Button variant="primary" icon={<Play className="size-4" />} onClick={run}>
              Run report
            </Button>
          </div>
        }
      />
      <TypeBuilder def={def} value={cfg} onChange={(c) => (setCfg(c), setErrors({}))} errors={errors} />
      <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t border-line bg-surface px-4 py-3 lg:hidden">
        {saveAction?.(cfg)}
        <Button variant="primary" className="flex-1" icon={<Play className="size-4" />} onClick={run}>
          Run report
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ result chrome */
function ResultScreen({
  def, config, onConfig, title, back, savedId, existing, onEdit,
}: {
  def: ReportTypeDef
  config: ReportTypeConfig
  onConfig: (c: ReportTypeConfig) => void
  title: string
  back: { to: string; label: string }
  savedId?: string
  existing?: SavedReportView | null
  onEdit: () => void
}) {
  const c = useCan()
  const readOnly = useReadOnly()
  const nav = useNavigate()
  const { confirm } = useConfirm()
  const chartRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const run = useTypedRun(def.id, config, savedId)
  const r = run.data
  const del = useMut(() => reportsApi.remove(existing!.id, existing!.version), { invalidate: [['reports']], success: 'Report deleted', onSuccess: () => nav('/reports') })
  const dup = useMut(() => reportsApi.duplicate(existing!.id), { invalidate: [['reports']], success: 'Copy created', onSuccess: (x) => nav(`/reports/${x.id}`) })
  const preset = config.period?.preset
  const canSave = c('reports.build')
  return (
    <div>
      <PageHeader
        back={back}
        title={title}
        subtitle={existing?.description || def.description}
        meta={
          <>
            <Badge size="sm" tone="neutral">{CATEGORY_LABEL[def.category]} report</Badge>
            {existing && <span className="text-[12.5px] text-ink-3">{def.label} · by {existing.owner_name}{existing.shared ? ' · Shared' : ''}</span>}
          </>
        }
        actions={
          <>
            <ExportMenu table={r ? () => toTypedExport(r, title, chartRef.current) : null} filename={title} />
            {(!existing || (existing.can_edit && canSave)) && (
              <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={onEdit} disabled={!!existing && readOnly}>
                Edit
              </Button>
            )}
            {canSave && (!existing || existing.can_edit) && (
              <Button size="sm" variant={existing ? 'secondary' : 'primary'} icon={<Save className="size-3.5" />} onClick={() => setSaving(true)} disabled={readOnly}>
                {existing ? 'Save changes' : 'Save report'}
              </Button>
            )}
            {existing && (
              <Menu
                label="More actions"
                trigger={
                  <IconButton size="sm" label="More actions" variant="secondary">
                    <MoreHorizontal className="size-4" />
                  </IconButton>
                }
                items={[
                  ...(canSave ? [{ label: 'Duplicate', onSelect: () => dup.mutate(undefined), disabled: readOnly }] : []),
                  ...(existing.can_edit ? [{ separator: true, label: '' }, { label: 'Delete', danger: true, disabled: readOnly, onSelect: async () => (await confirm({ title: `Delete “${existing.name}”?`, body: existing.shared ? 'It’s shared — the team will lose it too. This can’t be undone.' : 'This can’t be undone.', confirmLabel: 'Delete report', tone: 'danger' })) && del.mutate(undefined) }] : []),
                ]}
              />
            )}
          </>
        }
      />
      {def.has_period && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            className="w-full sm:w-[240px]"
            aria-label="Period"
            value={preset ?? 'custom'}
            onChange={(e) => e.target.value !== 'custom' && onConfig({ ...config, period: { preset: e.target.value } })}
            options={[...Object.entries(PRESET_LABEL).map(([k, v]) => ({ value: k, label: v })), ...(preset ? [] : [{ value: 'custom', label: `${config.period?.from} → ${config.period?.to}` }])]}
          />
          {run.isFetching && <Loader2 className="size-4 animate-spin text-ink-3" aria-label="Updating" />}
        </div>
      )}
      {run.error ? (
        <ErrorState error={run.error} onRetry={() => run.refetch()} />
      ) : !r ? (
        <div className="space-y-4">
          <SkeletonCards n={4} />
          <SkeletonRows rows={8} />
        </div>
      ) : (
        <TypeResult r={r} fetching={run.isFetching} chartRef={chartRef} />
      )}
      {saving && <SaveTypedDialog open={saving} onOpenChange={setSaving} def={def} config={r?.config ?? config} existing={existing} />}
    </div>
  )
}

/* ------------------------------------------------------------------ routes */
export default function ReportTypePage({ mode }: { mode: 'builder' | 'result' }) {
  const { type } = useParams<{ type: string }>()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const def = useReportType(type)
  const fromUrl = useMemo(() => decodeConfig(sp.get('c')), [sp])
  if (def.isLoading)
    return (
      <div>
        <SkeletonRows rows={8} />
      </div>
    )
  if (def.error || !def.data) return <ErrorState error={def.error} onRetry={() => def.refetch()} />
  const d = def.data
  const cfg = fromUrl ?? defaultConfig(d)
  const toResult = (c: ReportTypeConfig) => nav(`/reports/types/${d.id}/result?c=${encodeConfig(c)}`)
  if (mode === 'builder') return <BuilderScreen key={sp.get('c') ?? ''} def={d} initial={cfg} onRun={toResult} title={`New report · ${d.label}`} back={{ to: '/reports', label: 'Reports' }} />
  return <ResultScreen def={d} config={cfg} onConfig={(c) => nav(`/reports/types/${d.id}/result?c=${encodeConfig(c)}`, { replace: true })} title={d.label} back={{ to: `/reports/types/${d.id}?c=${encodeConfig(cfg)}`, label: 'Builder' }} onEdit={() => nav(`/reports/types/${d.id}?c=${encodeConfig(cfg)}`)} />
}

/** /reports/:id for a report saved from a type. */
export function TypedSavedView({ report }: { report: SavedReportView }) {
  const nav = useNavigate()
  const def = useReportType(report.report_type ?? undefined)
  const [sp, setSp] = useSearchParams()
  const over = useMemo(() => decodeConfig(sp.get('c')), [sp])
  if (def.isLoading) return <SkeletonRows rows={8} />
  if (def.error || !def.data) return <ErrorState error={def.error} onRetry={() => def.refetch()} />
  const config = over ?? report.report_config ?? defaultConfig(def.data)
  return (
    <ResultScreen
      def={def.data}
      config={config}
      onConfig={(c) => setSp({ c: encodeConfig(c) }, { replace: true })}
      title={report.name}
      back={{ to: '/reports', label: 'Reports' }}
      savedId={report.id}
      existing={report}
      onEdit={() => nav(`/reports/${report.id}/edit${over ? `?c=${encodeConfig(over)}` : ''}`)}
    />
  )
}

/** /reports/:id/edit for a report saved from a type. */
export function TypedSavedEdit({ report }: { report: SavedReportView }) {
  const nav = useNavigate()
  const def = useReportType(report.report_type ?? undefined)
  const [sp] = useSearchParams()
  const over = useMemo(() => decodeConfig(sp.get('c')), [sp])
  const [saving, setSaving] = useState<ReportTypeConfig | null>(null)
  if (def.isLoading) return <SkeletonRows rows={8} />
  if (def.error || !def.data) return <ErrorState error={def.error} onRetry={() => def.refetch()} />
  const initial = over ?? report.report_config ?? defaultConfig(def.data)
  return (
    <>
      <BuilderScreen
        def={def.data}
        initial={initial}
        title={`Edit · ${report.name}`}
        back={{ to: `/reports/${report.id}`, label: report.name }}
        onRun={(c) => nav(`/reports/${report.id}?c=${encodeConfig(c)}`)}
        saveAction={(c) =>
          report.can_edit ? (
            <Button icon={<Save className="size-4" />} onClick={() => setSaving(c)}>
              Save changes
            </Button>
          ) : null
        }
      />
      {saving && <SaveTypedDialog open={!!saving} onOpenChange={(o) => !o && setSaving(null)} def={def.data} config={saving} existing={report} />}
    </>
  )
}
