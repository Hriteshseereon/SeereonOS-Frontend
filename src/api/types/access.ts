// JSON shapes of the API (backend/app/routes/access.py). Types only — the backend is the source of truth.
import type { RoleDef } from '@/types/access'
import type { Action } from '@/domain/permissions'
import type { PendingBrief } from './makerChecker'

export type { PendingBrief }

export interface RoleRow extends RoleDef {
  user_count: number
  locked_permissions: string[]
  pending: PendingBrief | null
}

/* ------------------------------------------------------------------ */
/* Setup checklist                                                       */
/* ------------------------------------------------------------------ */
export interface SetupStep {
  key: 'org' | 'places' | 'structure' | 'roles' | 'controls' | 'people' | 'emails'
  title: string
  body: string
  done: boolean
  meta: string
  links: { label: string; to: string; action: Action }[]
}
