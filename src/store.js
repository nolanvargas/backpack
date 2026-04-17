import { create } from 'zustand'

export const useStore = create((set) => ({
  matches: [],
  setMatches: (m) => set({ matches: m })
}))
