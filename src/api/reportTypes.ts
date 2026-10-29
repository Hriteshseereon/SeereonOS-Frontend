// v9 (D9) — report types: catalogue → builder → server-computed result; typed reports save through POST /reports.
import { http } from './http'
import { useApi } from './query'
import type { ReportTypeCatalogue, ReportTypeConfig, ReportTypeDef, ReportTypeResult } from '@/api/types/viz'
import type { SavedReportView } from '@/api/types/reports'

export const reportTypesApi = {
  catalogue: () => http.get<ReportTypeCatalogue>('/report-types'),
  get: (id: string) => http.get<ReportTypeDef>(`/report-types/${encodeURIComponent(id)}`),
  run: (id: string, config: ReportTypeConfig) => http.post<ReportTypeResult>(`/report-types/${encodeURIComponent(id)}/run`, { config }),
  runSaved: (reportId: string, config?: ReportTypeConfig) => http.post<ReportTypeResult>(`/reports/${reportId}/run`, config ? { config } : {}),
  save: (b: { name: string; description?: string; report_type: string; config: ReportTypeConfig; shared?: boolean }) => http.full<SavedReportView>('POST', '/reports', { body: b }),
  update: (id: string, b: { name?: string; description?: string; config?: ReportTypeConfig; shared?: boolean }, version?: number) => http.full<SavedReportView>('PATCH', `/reports/${id}`, { body: b, ifMatch: version }),
}

export const useReportTypeCatalogue = () => useApi(['report-types', 'catalogue'], reportTypesApi.catalogue, { staleTime: 60_000 })
export const useReportType = (id: string | undefined) => useApi(['report-types', 'def', id], () => reportTypesApi.get(id!), { enabled: !!id })

/** Config <-> URL (base64url JSON) so a result page survives a reload and can be shared with a colleague. */
export function encodeConfig(c: ReportTypeConfig): string {
  const json = JSON.stringify(c)
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeConfig(s: string | null | undefined): ReportTypeConfig | null {
  if (!s) return null
  try {
    const b = s.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))
    const v = JSON.parse(json)
    return v && typeof v === 'object' ? (v as ReportTypeConfig) : null
  } catch {
    return null
  }
}
