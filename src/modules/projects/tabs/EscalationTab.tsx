// Project › Escalation (v9, D3): the escalation matrix recorded in the New Project wizard, viewable by everyone on
// the project and editable by its editors (PM / admins). Saved with PUT /projects/:id/escalation.
import { useEffect, useState } from 'react'
import { Pencil } from '@/ui/icons'
import type { ProjectDetail } from '@/api/projects'
import { useMut } from '@/api/query'
import { useEscalation, wizardApi, type EscalationMatrix } from '@/api/projectWizard'
import { usePeopleMap } from '@/api/core'
import { fmtDateTime } from '@/domain/calendar'
import { Button, Card, CardHeader, EmptyState, ErrorState, SkeletonRows, useReadOnly, useUnsavedChanges } from '@/ui'
import { newKey } from '../costing/costingDraft'
import { EscalationEditor } from '../wizard/WizardSteps'
import { validateEscRows, type EscDraftRow } from '../wizard/wizardDraft'

const UNIT: Record<string, string> = { hours: 'hours', days: 'days', working_days: 'working days' }

function toDraft(m: EscalationMatrix): EscDraftRow[] {
  return m.rows.map((r) => ({
    key: newKey('e'), level: String(r.level), who: r.user_id ? 'person' : 'external', user_id: r.user_id, name: r.user_id ? '' : r.name, role: r.role, email: r.email, phone: r.phone,
    after_value: r.after_value === null ? '' : String(r.after_value), after_unit: r.after_unit, scope: r.scope,
  }))
}

export function EscalationTab({ d }: { d: ProjectDetail }) {
  const q = useEscalation(d.project.id)
  const readOnly = useReadOnly()
  const people = usePeopleMap()
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<EscDraftRow[]>([])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const { confirmDiscard, release } = useUnsavedChanges(editing && dirty)
  useEffect(() => {
    if (q.data && !editing) {
      setRows(toDraft(q.data.matrix))
      setNotes(q.data.matrix.notes)
    }
  }, [q.data, editing])
  const save = useMut(
    () =>
      wizardApi.saveEscalation(
        d.project.id,
        {
          rows: rows.map((r) => ({ level: Number(r.level) || 1, user_id: r.who === 'person' ? r.user_id : null, name: r.who === 'external' ? r.name : '', role: r.role, email: r.email, phone: r.phone, after_value: r.after_value === '' ? null : Number(r.after_value), after_unit: r.after_unit, scope: r.scope })),
          notes,
        },
        q.data?.version,
      ),
    {
      success: 'Escalation matrix saved',
      silentError: false,
      onSuccess: () => {
        release()
        setEditing(false)
        setDirty(false)
        setErrors({})
      },
      onError: (e) => e.field && setErrors({ [e.field.replace(/^escalation\./, '')]: e.message }),
    },
  )
  if (q.isLoading) return <Card><SkeletonRows rows={4} /></Card>
  if (q.error || !q.data) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
  const v = q.data
  const m = v.matrix
  return (
    <Card>
      <CardHeader
        title="Escalation matrix"
        subtitle={v.updated_by_name && m.updated_at ? `Updated by ${v.updated_by_name} · ${fmtDateTime(m.updated_at)}` : 'Who is called when something slips, in order.'}
        action={
          v.can_edit && !readOnly && !editing ? (
            <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              {m.rows.length || m.notes ? 'Edit' : 'Set up'}
            </Button>
          ) : undefined
        }
      />
      {editing ? (
        <>
          <EscalationEditor rows={rows} notes={notes} errors={errors} onChange={(r, n) => { setRows(r); setNotes(n); setDirty(true); setErrors({}) }} />
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button onClick={async () => { if (await confirmDiscard()) { setEditing(false); setDirty(false); setErrors({}) } }}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={() => {
              const local = validateEscRows(rows, notes) // V9-FIX (item 10): the server's rules, before saving
              if (Object.keys(local).length) setErrors(local)
              else save.mutate(undefined)
            }}>Save matrix</Button>
          </div>
        </>
      ) : !m.rows.length && !m.notes ? (
        <EmptyState title="No escalation matrix yet" body={v.can_edit ? 'Record who is called at each level, and after how long.' : 'The project manager hasn’t recorded one yet.'} compact />
      ) : (
        <>
          {m.rows.length > 0 && (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Level', 'Who', 'Role', 'Contact', 'Escalate after', 'Scope'].map((h) => (
                      <th key={h} className="h-9 px-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((r, i) => (
                    <tr key={i} className="border-b border-line align-top">
                      <td className="tnum px-2 py-2.5 font-semibold">L{r.level}</td>
                      <td className="px-2 py-2.5 font-medium">{r.user_id ? people.get(r.user_id)?.name ?? r.name : r.name}{!r.user_id && <span className="ml-1 text-[12px] font-normal text-ink-3">(external)</span>}</td>
                      <td className="px-2 py-2.5 text-ink-2">{r.role || '—'}</td>
                      <td className="px-2 py-2.5 text-ink-2"><div className="break-all">{r.email || '—'}</div>{r.phone && <div className="tnum">{r.phone}</div>}</td>
                      <td className="tnum whitespace-nowrap px-2 py-2.5 text-ink-2">{r.after_value === null ? '—' : `${r.after_value} ${r.after_value === 1 ? UNIT[r.after_unit].replace(/s$/, '') : UNIT[r.after_unit]}`}</td>
                      <td className="px-2 py-2.5 text-ink-2">{r.scope || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {m.notes && (
            <div className="mt-4">
              <h4 className="mb-1 text-[13px] font-semibold">Notes</h4>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{m.notes}</p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
