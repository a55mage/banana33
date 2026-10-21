import { create } from 'zustand'
import type { Vec2 } from '../model/schema'

export type Tool = 'select' | 'wall' | 'door' | 'window'
export type ViewMode = '2d' | '3d'
/** manipolatore stile Unity: Q nessuno, W sposta, E ruota, R scala */
/** muri in 3D: alti, ritagliati verso la camera (The Sims), tutti bassi */
export type WallMode = 'up' | 'cutaway' | 'down'
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
  /** forma o gruppo di un modello 3D */
  | { type: 'node'; id: string }
  /** più forme di un modello 3D (Ctrl/Shift + clic) */
  | { type: 'nodes'; ids: string[] }
  /** più oggetti selezionati con Ctrl/Shift (non ancora raggruppati) */
  | { type: 'multi'; ids: string[] }
  | null

interface UiState {
  tool: Tool
  view: ViewMode
  gizmo: GizmoMode
  wallMode: WallMode
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
  showNewProject: boolean
  showExport: boolean
  /** avviso temporaneo (es. limite di forme raggiunto) */
  notice: string | null
  /** errore del disegno 3D (shader non compilato dalla scheda video) */
  renderError: string | null
  /** evidenzia le collisioni (rosso, badge, stato); la disposizione automatica le evita comunque */
  showCollisions: boolean
  /** modelli 3D: contorno sempre visibile delle forme che scavano o intersecano */
  showCutters: boolean
  setTool: (t: Tool) => void
  setView: (v: ViewMode) => void
  setGizmo: (g: GizmoMode) => void
  setWallMode: (m: WallMode) => void
  cycleWallMode: () => void
  setSelection: (s: Selection) => void
  setSnap: (s: number) => void
  setWallDraft: (p: Vec2 | null) => void
  setCursor: (p: Vec2 | null) => void
  setDrag: (d: UiState['drag']) => void
  resetForProject: () => void
  requestFit: () => void
  setShowHelp: (v: boolean) => void
  setShowNewProject: (v: boolean) => void
  setShowExport: (v: boolean) => void
  setNotice: (n: string | null) => void
  setRenderError: (e: string | null) => void
  toggleCollisions: () => void
  setShowCutters: (v: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  tool: 'select',
  view: '2d',
  gizmo: 'translate',
  wallMode: 'cutaway',
  selection: null,
  snap: 0.05,
  wallDraft: null,
  cursor: null,
  drag: null,
  fitNonce: 0,
  showHelp: false,
  showNewProject: false,
  showExport: false,
  notice: null,
  renderError: null,
  showCollisions: readShowCollisions(),
  showCutters: false,
  setTool: (tool) => set({ tool, wallDraft: null }),
  setView: (view) => set({ view }),
  setWallMode: (wallMode) => set({ wallMode }),
  cycleWallMode: () => set((s) => ({ wallMode: s.wallMode === 'up' ? 'cutaway' : s.wallMode === 'cutaway' ? 'down' : 'up' })),
  setGizmo: (gizmo) => set({ gizmo, tool: 'select', wallDraft: null }),
  setSelection: (selection) => set({ selection }),
  setSnap: (snap) => set({ snap }),
  setWallDraft: (wallDraft) => set({ wallDraft }),
  setCursor: (cursor) => set({ cursor }),
  setDrag: (drag) => set({ drag }),
  resetForProject: () => set({ selection: null, wallDraft: null, drag: null, notice: null, renderError: null }),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  setShowHelp: (showHelp) => set({ showHelp }),
  setShowNewProject: (showNewProject) => set({ showNewProject }),
  setShowExport: (showExport) => set({ showExport }),
  setNotice: (notice) => set({ notice }),
  setRenderError: (renderError) => set({ renderError }),
  setShowCutters: (showCutters) => set({ showCutters }),
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
