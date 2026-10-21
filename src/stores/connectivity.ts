// Whether the API is reachable. Set by the transport (src/api/http.ts) on every response; read by the global
// "can't reach the server" banner.
import { create } from 'zustand'

export interface ConnectivityState {
  down: boolean
  message: string | null
  since: number | null
  markDown: (message: string) => void
  markUp: () => void
}

export const useConnectivity = create<ConnectivityState>((set, get) => ({
  down: false,
  message: null,
  since: null,
  markDown: (message) => set({ down: true, message, since: get().since ?? Date.now() }),
  markUp: () => {
    if (get().down) set({ down: false, message: null, since: null })
  },
}))
