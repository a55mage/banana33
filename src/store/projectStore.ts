import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { nanoid } from 'nanoid'
import type { OpeningKind, Project, SceneObject, Vec2 } from '../model/schema'
import { newObject, newProject, OPENING_DEFAULTS, WALL_DEFAULTS, type Preset } from '../model/factory'
import { autoLayout, layoutBounds, type LayoutResult } from '../geometry/autoLayout'
import { useUi } from './uiStore'

const HISTORY_LIMIT = 100

interface ProjectState {
  project: Project
  past: Project[]
  future: Project[]
  /** modifica il progetto; con history:false non crea un passo di annullamento (es. durante il drag) */
  mutate: (recipe: (d: Draft<Project>) => void, opts?: { history?: boolean }) => void
  /** salva lo stato corrente nella cronologia (prima di una serie di modifiche senza history) */
  checkpoint: () => void
  undo: () => void
  redo: () => void
  load: (p: Project) => void
}

export const useProject = create<ProjectState>((set, get) => ({
  project: newProject('space'),
  past: [],
  future: [],
  mutate: (recipe, opts) => {
    const { project, past } = get()
    const next = produce(project, (d) => {
      recipe(d)
      d.updatedAt = Date.now()
    })
    if (opts?.history === false) set({ project: next })
    else set({ project: next, past: [...past.slice(-HISTORY_LIMIT), project], future: [] })
  },
  checkpoint: () => {
    const { project, past } = get()
    set({ past: [...past.slice(-HISTORY_LIMIT), project], future: [] })
  },
  undo: () => {
    const { project, past, future } = get()
    const prev = past.at(-1)
    if (!prev) return
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future] })
  },
  redo: () => {
    const { project, past, future } = get()
    const next = future[0]
    if (!next) return
    set({ project: next, past: [...past, project], future: future.slice(1) })
  },
  load: (p) => {
    set({ project: p, past: [], future: [] })
    useUi.getState().resetForProject()
  },
}))

const mutate: ProjectState['mutate'] = (r, o) => useProject.getState().mutate(r, o)

// ---------- azioni ----------

export function addObject(preset: Preset) {
  const p = useProject.getState().project
  const b = layoutBounds(p)
  const pos: Vec2 = b ? [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] : [0, 0]
  const o = newObject(preset, pos)
  mutate((d) => {
    d.objects.push(o)
  })
  useUi.getState().setSelection({ type: 'object', id: o.id })
}

export function updateObject(id: string, patch: Partial<SceneObject>, history = true) {
  mutate(
    (d) => {
      const o = d.objects.find((x) => x.id === id)
      if (o) Object.assign(o, patch)
    },
    { history },
  )
}

export function duplicateObject(id: string) {
  const o = useProject.getState().project.objects.find((x) => x.id === id)
  if (!o) return
  const copy: SceneObject = { ...o, id: nanoid(), name: `${o.name} (copia)`, position: [o.position[0] + 0.2, o.position[1] + 0.2] }
  mutate((d) => {
    d.objects.push(copy)
  })
  useUi.getState().setSelection({ type: 'object', id: copy.id })
}

export function addWall(a: Vec2, b: Vec2) {
  mutate((d) => {
    d.walls.push({ id: nanoid(), a, b, ...WALL_DEFAULTS })
  })
}

export function addOpening(wallId: string, kind: OpeningKind, offset: number) {
  const id = nanoid()
  mutate((d) => {
    d.openings.push({ id, wallId, kind, offset, ...OPENING_DEFAULTS[kind] })
  })
  useUi.getState().setSelection({ type: 'opening', id })
}

export function deleteSelection() {
  const sel = useUi.getState().selection
  if (!sel) return
  mutate((d) => {
    if (sel.type === 'object') d.objects = d.objects.filter((o) => o.id !== sel.id)
    if (sel.type === 'wall') {
      d.walls = d.walls.filter((w) => w.id !== sel.id)
      d.openings = d.openings.filter((o) => o.wallId !== sel.id)
    }
    if (sel.type === 'opening') d.openings = d.openings.filter((o) => o.id !== sel.id)
  })
  useUi.getState().setSelection(null)
}

export function rotateSelection(deg: number) {
  const sel = useUi.getState().selection
  if (sel?.type !== 'object') return
  mutate((d) => {
    const o = d.objects.find((x) => x.id === sel.id)
    if (o) o.rotation = (((o.rotation + deg) % 360) + 360) % 360
  })
}

export function runAutoLayout(gap: number): LayoutResult {
  const res = autoLayout(useProject.getState().project, gap)
  if (Object.keys(res.placements).length > 0) {
    mutate((d) => {
      for (const o of d.objects) {
        const pl = res.placements[o.id]
        if (pl) {
          o.position = pl.position
          o.rotation = pl.rotation
        }
      }
    })
  }
  return res
}
