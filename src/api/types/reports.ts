// JSON shapes of the API (backend/app/routes/reports.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'

/* ------------------------------------------------------------------ */
/* Saved reports                                                        */
/* ------------------------------------------------------------------ */
export interface SavedReportView extends E.SavedReport {
  owner_name: string
  can_edit: boolean
  dataset_label: string
  preview: { labels: string[]; values: number[]; kind: string; value?: number | null; format: string } | null
}
