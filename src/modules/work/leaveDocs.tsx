// v9 (CEO request 5) — supporting documents on a leave application: pick them when applying, add or remove them
// later (the applicant), and open them (the applicant, the approvers on the request's route and HR — the server
// decides, `can_open_docs` mirrors it). PDF, PNG, JPG or DOCX, up to 5 MB each, up to 3 per request.
import { useEffect, useRef, useState } from 'react'
import { Download, Paperclip, Plus, X } from '@/ui/icons'
import { hrApi, LEAVE_INVALIDATE, type LeaveFileInput, type LeaveRequestView } from '@/api/hr'
import { useMut } from '@/api/query'
import { cn, saveFile } from '@/lib/utils'
import type { LeaveAttachment } from '@/types/business'
import { Button, Dialog, Skeleton, toast, useConfirm, useReadOnly } from '@/ui'

export const LEAVE_DOC_MAX = 3
const MAX_BYTES = 5 * 1024 * 1024
const EXT = /\.(pdf|png|jpe?g|docx)$/i
export const LEAVE_DOC_ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Read a picked file as a data: URL after the same checks as the server (type, size). */
export function readLeaveFile(file: File): Promise<LeaveFileInput> {
  return new Promise((resolve, reject) => {
    if (!EXT.test(file.name)) return reject(new Error(`${file.name}: use a PDF, PNG, JPG or DOCX file.`))
    if (!file.size) return reject(new Error(`${file.name} is empty.`))
    if (file.size > MAX_BYTES) return reject(new Error(`${file.name} is larger than 5 MB. Scan it at a lower resolution or upload a PDF.`))
    const r = new FileReader()
    r.onload = () => (typeof r.result === 'string' ? resolve({ name: file.name, size_bytes: file.size, mime: file.type || 'application/octet-stream', data_url: r.result }) : reject(new Error(`${file.name} could not be read.`)))
    r.onerror = () => reject(new Error(`${file.name} could not be read.`))
    r.readAsDataURL(file)
  })
}

/** A small "attach" button with its own hidden file input. */
function PickButton({ onPick, disabled, label = 'Attach a document', loading }: { onPick: (f: File) => void; disabled?: boolean; label?: string; loading?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={LEAVE_DOC_ACCEPT}
        className="hidden"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onPick(f)
        }}
      />
      <Button size="xs" variant="secondary" icon={<Plus className="size-3.5" />} disabled={disabled} loading={loading} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  )
}

/** The documents section of the Apply for leave dialog (files are sent with the request). */
export function LeaveDocPicker({ files, onChange, error, onError }: { files: LeaveFileInput[]; onChange: (f: LeaveFileInput[]) => void; error?: string; onError: (m: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const add = async (file: File) => {
    onError(null)
    if (files.length >= LEAVE_DOC_MAX) return onError(`Attach up to ${LEAVE_DOC_MAX} documents.`)
    try {
      onChange([...files, await readLeaveFile(file)])
    } catch (e) {
      onError((e as Error).message)
    }
  }
  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <div key={`${f.name}${i}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <Paperclip className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{f.name}</span>
          <span className="tnum shrink-0 text-[12px] text-ink-3">{kb(f.size_bytes)}</span>
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      ))}
      {files.length < LEAVE_DOC_MAX && (
        <>
          <input
            ref={ref}
            type="file"
            accept={LEAVE_DOC_ACCEPT}
            className="hidden"
            aria-label="Attach a supporting document"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void add(f)
            }}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void add(f)
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-3 text-left transition hover:border-brand hover:bg-surface-2/60"
          >
            <Paperclip className="size-4 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink">Attach a document</span>
              <span className="block text-[12px] text-ink-3">Optional · e.g. a medical certificate · PDF, PNG, JPG or DOCX up to 5 MB · up to {LEAVE_DOC_MAX}</span>
            </span>
          </button>
        </>
      )}
      {error && <p className="text-[12.5px] font-medium text-danger-text">{error}</p>}
    </div>
  )
}

/** The documents of a request in a list: open (when allowed), and for the applicant add / remove. */
export function LeaveDocs({ r, manage, className }: { r: LeaveRequestView; manage?: boolean; className?: string }) {
  const ro = useReadOnly()
  const { confirm } = useConfirm()
  const [view, setView] = useState<LeaveAttachment | null>(null)
  const docs = r.attachments ?? []
  const canAdd = !!manage && !ro && (r.status === 'pending' || r.status === 'approved') && docs.length < LEAVE_DOC_MAX
  const canRemove = !!manage && !ro && r.status === 'pending'
  const add = useMut((f: LeaveFileInput) => hrApi.addLeaveDoc(r.id, f), { invalidate: LEAVE_INVALIDATE, success: (_x, f) => `Attached ${f.name}` })
  const remove = useMut((a: LeaveAttachment) => hrApi.removeLeaveDoc(r.id, a.id), { invalidate: LEAVE_INVALIDATE, success: (_x, a) => `Removed ${a.name}` })
  if (!docs.length && !canAdd) return null
  const pick = async (file: File) => {
    try {
      add.mutate(await readLeaveFile(file))
    } catch (e) {
      toast.error('Can’t attach that file', { description: (e as Error).message })
    }
  }
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} onClick={(e) => e.stopPropagation()}>
      {docs.map((a) => (
        <span key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pl-1.5 pr-1 text-[12.5px] text-ink-2">
          <Paperclip className="size-3.5 shrink-0 text-ink-3" />
          {r.can_open_docs ? (
            <button type="button" onClick={() => setView(a)} className="min-w-0 truncate font-medium text-brand-text hover:underline" title={`Open ${a.name}`}>
              {a.name}
            </button>
          ) : (
            <span className="min-w-0 truncate" title="Only the applicant, their approvers and HR can open it">{a.name}</span>
          )}
          {canRemove && (
            <button
              type="button"
              aria-label={`Remove ${a.name}`}
              disabled={remove.isPending}
              onClick={async () => (await confirm({ title: `Remove ${a.name}?`, body: 'Your approver will no longer see it.', confirmLabel: 'Remove', tone: 'danger' })) && remove.mutate(a)}
              className="grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface hover:text-ink"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {canAdd && <PickButton onPick={pick} loading={add.isPending} label={docs.length ? 'Add' : 'Add document'} />}
      {view && <LeaveDocViewer r={r} a={view} onClose={() => setView(null)} />}
    </div>
  )
}

/** Preview (PDF / image) with download; DOCX downloads. */
function LeaveDocViewer({ r, a, onClose }: { r: LeaveRequestView; a: LeaveAttachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let u: string | null = null
    hrApi
      .leaveDoc(r.id, a.id)
      .then(async (f) => {
        const b = await (await fetch(f.data_url)).blob()
        if (!alive) return
        u = URL.createObjectURL(b)
        setBlob(b)
        setUrl(u)
      })
      .catch((e) => alive && setErr((e as Error).message || 'The document could not be opened.'))
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [r.id, a.id])
  const isImg = a.mime.startsWith('image/')
  const isPdf = a.mime === 'application/pdf'
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={a.name}
      description={`${r.user_name} · leave ${r.from_on === r.to_on ? r.from_on : `${r.from_on} – ${r.to_on}`} · ${kb(a.size_bytes)}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Download className="size-4" />} disabled={!blob} onClick={() => blob && saveFile(a.name, blob, a.mime)}>
            Download
          </Button>
        </>
      }
    >
      {err ? (
        <p className="text-[13.5px] text-danger-text">{err}</p>
      ) : !url ? (
        <Skeleton className="h-[320px] w-full rounded-lg" />
      ) : isImg ? (
        <img src={url} alt={a.name} className="mx-auto max-h-[60vh] max-w-full rounded-md border border-line object-contain" />
      ) : isPdf ? (
        <iframe src={url} title={a.name} className="h-[60vh] w-full rounded-md border border-line" />
      ) : (
        <p className="text-[13.5px] text-ink-2">Word documents can’t be previewed here. Download it to open it.</p>
      )}
    </Dialog>
  )
}
