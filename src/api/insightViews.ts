// v9 — Insights with visuals (/insight-views): the catalogue (one question per view) and each view's KPIs, charts and table.
import { http } from './http'
import { useApi } from './query'
import type { InsightCatalogue, InsightViewResult } from '@/api/types/viz'

export type * from '@/api/types/viz'

export const insightViewsApi = {
  catalogue: () => http.get<InsightCatalogue>('/insight-views'),
  view: (id: string) => http.get<InsightViewResult>(`/insight-views/${encodeURIComponent(id)}`),
}

export const useInsightCatalogue = () => useApi(['insight-views', 'catalogue'], insightViewsApi.catalogue)
export const useInsightView = (id: string | null) => useApi(['insight-views', id], () => insightViewsApi.view(id!), { enabled: !!id, placeholderData: (p) => p })
