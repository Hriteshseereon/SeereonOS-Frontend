// JSON shapes of the API (backend/app/engine/maker_checker.py). Types only — the backend is the source of truth.
import type { ChangeEntity } from '@/types/access'

/** Pending change in a light shape for record screens ("waiting for approval" states). */
export interface PendingBrief {
  id: string
  summary: string
  maker_id: string
  maker_name: string
  created_at: string
  checker_names: string[]
  mine: boolean
  can_check: boolean
}

export interface CheckerRow {
  entity: ChangeEntity
  label: string
  required_permission: string
  required_label: string
  enabled: boolean
  recommended: boolean
  checkers: { id: string; name: string; title: string; hue: number }[]
  /** Eligible checkers other than the viewer (a viewer making a change needs at least one). */
  others: number
}
