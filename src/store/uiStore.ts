import { create } from 'zustand'
import type { Vec2 } from '../model/schema'

export type Tool = 'select' | 'wall' | 'door' | 'window'
export type ViewMode = '2d' | '3d'
export type Selection = { type: 'object' | 'wall' | 'opening'; id: string } | null

interface UiState {
  tool: Tool
  view: ViewMode
  selection: Selection
  /** passo di aggancio alla griglia in metri */
  snap: number
  /** punto di partenza del muro in disegno */
  wallDraft: Vec2 | null
  cursor: Vec2 | null
  drag: { id: string; offset: Vec2 } | null
  setTool: (t: Tool) => void
  setView: (v: ViewMode) => void
  setSelection: (s: Selection) => void
  setSnap: (s: number) => void
  setWallDraft: (p: Vec2 | null) => void
  setCursor: (p: Vec2 | null) => void
  setDrag: (d: UiState['drag']) => void
  resetForProject: () => void
}

export const useUi = create<UiState>((set) => ({
  tool: 'select',
  view: '2d',
  selection: null,
  snap: 0.05,
  wallDraft: null,
  cursor: null,
  drag: null,
  setTool: (tool) => set({ tool, wallDraft: null }),
  setView: (view) => set({ view }),
  setSelection: (selection) => set({ selection }),
  setSnap: (snap) => set({ snap }),
  setWallDraft: (wallDraft) => set({ wallDraft }),
  setCursor: (cursor) => set({ cursor }),
  setDrag: (drag) => set({ drag }),
  resetForProject: () => set({ selection: null, wallDraft: null, drag: null }),
}))
