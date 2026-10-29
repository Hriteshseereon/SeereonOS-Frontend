// v9 — chart contracts computed by the backend (app/routes/insight_views.py, app/reports/types.py). Types only:
// every number, label and finding comes from the server; the frontend only draws.
import type { Tone } from '@/domain/labels'
import type { InsightCell, InsightColumn, InsightResult } from './dashboards'

export type VizFormat = 'number' | 'money' | 'percent' | 'hours' | 'days' | 'ratio'

export interface VizSeries {
  key: string
  label: string
  values: (number | null)[]
}

/** Bars over categories ("column" = vertical, "bar" = horizontal), lines over time, or a donut (reports only). */
export interface CartesianViz {
  id?: string
  kind: 'column' | 'bar' | 'line' | 'donut'
  title: string
  subtitle?: string
  format: VizFormat
  categories: string[]
  series: VizSeries[]
  stacked?: boolean
  /** Reference lines (targets, thresholds) on the value axis. */
  refs?: { value: number; label: string }[]
  /** One link per category (opens the project / deal / list behind it). */
  links?: (string | null)[]
  /** Ordered categories (ageing buckets, funnel stages): one hue in ordered steps. */
  ordinal?: boolean
  x_label?: string
  y_label?: string
  /** Set when there is nothing to plot. */
  empty?: string | null
}

export type GanttState = 'on_track' | 'at_risk' | 'late' | 'done' | 'done_late' | 'not_started' | 'on_hold' | 'due_soon'

export interface GanttMarker {
  date: string
  label: string
  state: GanttState
  state_label: string
  baseline?: string | null
  forecast?: string | null
  /** V9-FIX: where a click on the marker goes (the milestone on the project's WBS tab) */
  link?: string
}

export interface GanttRow {
  id: string
  label: string
  sub?: string
  link?: string
  start: string
  end: string
  forecast?: string | null
  range?: { from: string; to: string } | null
  progress?: number | null
  status: GanttState
  status_label: string
  markers: GanttMarker[]
  detail: string[]
}

export interface GanttViz {
  id?: string
  kind: 'gantt'
  /** bars = planned span + progress + forecast tick; milestones = diamonds only; forecast = P50–P80 band */
  mode: 'bars' | 'milestones' | 'forecast'
  title: string
  subtitle?: string
  from: string
  to: string
  today: string
  rows: GanttRow[]
  legend: { key: GanttState; label: string }[]
  empty?: string | null
}

export interface HeatmapViz {
  id?: string
  kind: 'heatmap'
  title: string
  subtitle?: string
  format: 'percent'
  /** Columns before this index are actuals, from it on plans (a divider is drawn). */
  split?: number
  cols: { key: string; label: string; sub?: string; future?: boolean }[]
  rows: { id: string; label: string; sub?: string; link?: string; cells: { v: number | null; note?: string }[] }[]
  thresholds: { over: number; under: number }
  empty?: string | null
}

export interface FunnelViz {
  id?: string
  kind: 'funnel'
  title: string
  subtitle?: string
  format: 'money'
  stages: { key: string; label: string; count: number; value: number; reached: number; conversion: number | null }[]
  empty?: string | null
}

export type Viz = CartesianViz | GanttViz | HeatmapViz | FunnelViz

/* ------------------------------------------------------------------ */
/* Insight views (/insight-views)                                       */
/* ------------------------------------------------------------------ */
export type InsightGroup = 'prediction' | 'delivery' | 'people' | 'finance' | 'sales'

export interface InsightCatalogue {
  groups: { id: InsightGroup; label: string }[]
  views: { id: string; label: string; group: InsightGroup; question: string; count: number | null }[]
  default: string | null
}

export interface InsightViewResult extends Omit<InsightResult, 'view'> {
  view: string
  label: string
  group: InsightGroup
  question: string
  finding: string
  charts: Viz[]
}

/* ------------------------------------------------------------------ */
/* Report types (/report-types)                                         */
/* ------------------------------------------------------------------ */
export type ReportCategory = 'financial' | 'attendance' | 'salary' | 'task' | 'project' | 'timesheet'
export type ReportFilterKey = 'period' | 'project' | 'customer' | 'team' | 'person' | 'status'
export type ReportChartChoice = 'auto' | 'bar' | 'column' | 'line' | 'donut' | 'none'

export interface ReportTypeCatalogue {
  categories: {
    id: ReportCategory
    label: string
    description: string
    types: { id: string; label: string; description: string; needs_salary: boolean }[]
    locked: { id: string; label: string; reason: string }[]
  }[]
  can_save: boolean
}

export interface ReportTypeField {
  key: string
  label: string
  type: 'string' | 'number' | 'money' | 'percent' | 'date' | 'enum' | 'boolean'
  unit?: string
  options?: { value: string; label: string }[]
  total?: 'sum'
}

export interface ReportTypeConfig {
  fields?: string[]
  period?: { preset?: string; from?: string; to?: string }
  filters?: Partial<Record<Exclude<ReportFilterKey, 'period'>, string[]>>
  group_by?: string | null
  sort?: { field: string; dir: 'asc' | 'desc' } | null
  chart?: ReportChartChoice
  chart_by?: string
}

export interface ReportTypeDef {
  id: string
  category: ReportCategory
  label: string
  description: string
  noun: string
  filters: ReportFilterKey[]
  date_label: string | null
  has_period: boolean
  default_period: string
  fields: ReportTypeField[]
  default_fields: string[]
  groups: { value: string; label: string }[]
  default_group: string | null
  default_sort: { field: string; dir: 'asc' | 'desc' }
  charts: ReportChartChoice[]
  chart_by: { value: string; label: string }[]
  default_chart_by: string
  needs_salary: boolean
  options?: {
    project: string[]
    customer: string[]
    person: string[]
    team: { value: string; label: string; kind: 'team' | 'department' }[]
    status: { value: string; label: string }[]
  }
}

export type ReportColType = 'string' | 'number' | 'money' | 'percent' | 'date' | 'enum' | 'boolean' | 'hours' | 'days' | 'ratio'

export interface ReportTypeResult {
  type: string
  category: ReportCategory
  category_label: string
  title: string
  description: string
  config: Required<Pick<ReportTypeConfig, 'fields' | 'period' | 'filters' | 'chart' | 'chart_by'>> & { group_by: string | null; sort: ReportTypeConfig['sort'] }
  period: { from: string; to: string; label: string } | null
  filters_applied: { key: string; label: string; value: string }[]
  finding: string
  kpis: { key: string; label: string; value: number | null; format: VizFormat; tone?: Tone; hint?: string }[]
  chart: (Omit<CartesianViz, 'title'> & { title: string }) | null
  grouped: boolean
  columns: { key: string; label: string; type: ReportColType; align: 'left' | 'right'; agg?: 'sum' | 'avg' }[]
  rows: Record<string, string | number | boolean | null>[]
  totals: Record<string, number | null>
  row_count: number
  source_rows: number
  generated_at: string
  generated_by: string | null
  warnings: string[]
  /** Present when the result is a saved report re-run. */
  saved?: { id: string; name: string; description: string }
}

export type { InsightCell, InsightColumn }
