// JSON shapes of the API (backend/app/routes/payroll.py). Types only — the backend is the source of truth.
import type { PendingBrief } from './makerChecker'

export type { PendingBrief }

/** v4 extras on the run view (maker-checked finalisation); not part of the shared PayrollRunView type. */
export interface PayrollFinaliseState {
  pending_finalise: PendingBrief | null
  /** Finalising needs a second person (maker-checker on for payroll finalisation). */
  finalise_needs_checker: boolean
  /** The viewer may finalise directly (holds “Finalise payroll”) or request it (maker-checker on). */
  can_finalise: boolean
  finalise_checkers: string[]
}
