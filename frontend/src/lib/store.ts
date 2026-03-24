import { create } from "zustand";
import type { Trend } from "./types";

interface AppState {
  selectedTrend: Trend | null;
  setSelectedTrend: (trend: Trend | null) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  categoryFilter: string | null;
  setCategoryFilter: (cat: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTrend: null,
  setSelectedTrend: (trend) => set({ selectedTrend: trend }),
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),
  categoryFilter: null,
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),
}));
