// JSON shapes of the API (backend/app/engine/performance.py). Types only — the backend is the source of truth.

export interface TaskStats {
  assigned: number
  open: number
  overdue_open: number
  completed: number
  early: number
  on_time: number
  late: number
  on_time_pct: number | null // (early + on time) / completed
  avg_variance_days: number | null
  in_review: number
  sent_back: number // review rounds that ended in "sent back"
  first_pass_pct: number | null // approved on the first submission
  avg_quality: number | null // 1–5
  delay_reasons: Record<string, number>
}
