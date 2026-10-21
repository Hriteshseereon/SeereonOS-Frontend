// JSON shapes of the API (backend/app/routes/auth.py). Types only — the backend is the source of truth.
import type * as E from '@/types/entities'

/** Lightweight directory row used by every people picker, avatar and name lookup. */
export interface DirectoryPerson {
  id: string
  name: string
  title: string
  role: E.Role
  role_key: string
  role_name: string
  email: string
  reports_to_id: string | null
  avatar_hue: number
  status: E.User['status']
  department: E.User['department']
}
