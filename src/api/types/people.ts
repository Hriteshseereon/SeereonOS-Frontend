// JSON shapes of the API (backend/app/routes/people.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'
import type { EmailMessage } from '@/types/access'
import type { PendingBrief } from './makerChecker'

export type { PendingBrief }

export interface CreatedEmployee {
  user: UserRow
  employee_code: string
  login_email: string
  temp_password: string
  email: EmailMessage | null
  manager_name: string | null
  ctc_saved: boolean
  /** v7: the joining letter issued on create (Documents → Issued) */
  joining_letter_id?: string | null
  /** v7: the onboarding workflow started on create */
  onboarding_workflow_id?: string | null
}

/* ------------------------------------------------------------------ */
/* User rows                                                            */
/* ------------------------------------------------------------------ */
export interface UserRow extends E.User {
  role_name: string
  permissions: string[]
  role_permissions: string[]
  department_name: string | null
  designation_name: string | null
  grade_name: string | null
  location_name: string | null
  shift_name: string | null
  cost_centre_name: string | null
  manager_name: string | null
  direct_reports: number
  pending_access: PendingBrief | null
  pending_employee: PendingBrief | null
}
