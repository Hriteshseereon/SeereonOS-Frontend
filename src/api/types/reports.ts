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
  /** v9 (D9): set when the report was saved from a report type; it is re-run with this configuration. */
  report_type?: string | null
  report_config?: import('./viz').ReportTypeConfig | null
}
