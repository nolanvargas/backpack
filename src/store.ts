import { create } from 'zustand';

type Store = {
	matches: unknown[];
	setMatches: (m: unknown[]) => void;
};

export const useStore = create<Store>((set) => ({
	matches: [],
	setMatches: (m) => set({ matches: m }),
}));
