import { create } from 'zustand'
import type { Vec2 } from '../model/schema'

export type Tool = 'select' | 'wall' | 'door' | 'window'
export type ViewMode = '2d' | '3d'
/** manipolatore stile Unity: Q nessuno, W sposta, E ruota, R scala */
export type GizmoMode = 'none' | 'translate' | 'rotate' | 'scale'
const COLLISIONS_KEY = 'banana33:showCollisions'

function readShowCollisions() {
  try {
    return localStorage.getItem(COLLISIONS_KEY) !== '0'
  } catch {
    return true
  }
}

export type Selection =
  | { type: 'object' | 'wall' | 'opening' | 'group'; id: string }
  /** più oggetti selezionati con Ctrl/Shift (non ancora raggruppati) */
  | { type: 'multi'; ids: string[] }
  | null

interface UiState {
  tool: Tool
  view: ViewMode
  gizmo: GizmoMode
  selection: Selection
  /** passo di aggancio alla griglia in metri */
  snap: number
  /** punto di partenza del muro in disegno */
  wallDraft: Vec2 | null
  cursor: Vec2 | null
  /** trascinamento: oggetti coinvolti con le posizioni iniziali, punto afferrato e quota del piano */
  drag: { ids: string[]; starts: Vec2[]; origin: Vec2; y: number } | null
  /** incrementato per chiedere alla camera di reinquadrare la scena */
  fitNonce: number
  showHelp: boolean
  /** evidenzia le collisioni (rosso, badge, stato); la disposizione automatica le evita comunque */
  showCollisions: boolean
  setTool: (t: Tool) => void
  setView: (v: ViewMode) => void
  setGizmo: (g: GizmoMode) => void
  setSelection: (s: Selection) => void
  setSnap: (s: number) => void
  setWallDraft: (p: Vec2 | null) => void
  setCursor: (p: Vec2 | null) => void
  setDrag: (d: UiState['drag']) => void
  resetForProject: () => void
  requestFit: () => void
  setShowHelp: (v: boolean) => void
  toggleCollisions: () => void
}

export const useUi = create<UiState>((set) => ({
  tool: 'select',
  view: '2d',
  gizmo: 'translate',
  selection: null,
  snap: 0.05,
  wallDraft: null,
  cursor: null,
  drag: null,
  fitNonce: 0,
  showHelp: false,
  showCollisions: readShowCollisions(),
  setTool: (tool) => set({ tool, wallDraft: null }),
  setView: (view) => set({ view }),
  setGizmo: (gizmo) => set({ gizmo, tool: 'select', wallDraft: null }),
  setSelection: (selection) => set({ selection }),
  setSnap: (snap) => set({ snap }),
  setWallDraft: (wallDraft) => set({ wallDraft }),
  setCursor: (cursor) => set({ cursor }),
  setDrag: (drag) => set({ drag }),
  resetForProject: () => set({ selection: null, wallDraft: null, drag: null }),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  setShowHelp: (showHelp) => set({ showHelp }),
  toggleCollisions: () =>
    set((s) => {
      try {
        localStorage.setItem(COLLISIONS_KEY, s.showCollisions ? '0' : '1')
      } catch {
        // preferenza valida solo per questa sessione
      }
      return { showCollisions: !s.showCollisions }
    }),
}))
