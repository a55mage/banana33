import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { nanoid } from 'nanoid'
import type { Group, OpeningKind, Project, SceneObject, Unit, Vec2 } from '../model/schema'
import { defaultSizeOf, newObject, newProject, OPENING_DEFAULTS, WALL_DEFAULTS, type Preset } from '../model/factory'
import { autoLayout, layoutBounds, type LayoutResult } from '../geometry/autoLayout'
import { useUi, type Selection } from './uiStore'
import { aabbOf, objectFootprint } from '../geometry/footprint'
import { SNAP_STEPS, UNITS } from '../units'
import { getT } from '../i18n'

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
    // i modelli 3D non hanno una vista in pianta e sono piccoli: aggancio di 1 cm
    if (p.kind === 'model') {
      useUi.getState().setView('3d')
      useUi.getState().setSnap(0.01)
    }
  },
}))

const mutate: ProjectState['mutate'] = (r, o) => useProject.getState().mutate(r, o)

// ---------- azioni ----------

/** Posizione di default: centro dello spazio (o dei muri), altrimenti l'origine */
function defaultPosition(p: Project): Vec2 {
  const b = layoutBounds(p)
  return b ? [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] : [0, 0]
}

export function resetObject(id: string, what: 'size' | 'position' | 'rotation') {
  const p = useProject.getState().project
  const o = p.objects.find((x) => x.id === id)
  if (!o) return
  const patch: Partial<SceneObject> =
    what === 'size'
      ? { size: defaultSizeOf(o) }
      : what === 'position'
        ? { position: defaultPosition(p), elevation: 0 }
        : { rotation: 0, rotationX: 0, rotationZ: 0 }
  updateObject(id, patch)
}

export function addObject(preset: Preset) {
  const p = useProject.getState().project
  const pos = defaultPosition(p)
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

// ---------- selezione ----------

/** Oggetti coinvolti dalla selezione corrente (oggetto, gruppo o selezione multipla) */
export function selectedObjectIds(sel: Selection = useUi.getState().selection, p: Project = useProject.getState().project): string[] {
  if (!sel) return []
  if (sel.type === 'object') return [sel.id]
  if (sel.type === 'multi') return sel.ids
  if (sel.type === 'group') return p.objects.filter((o) => o.groupId === sel.id).map((o) => o.id)
  return []
}

function setObjectSelection(ids: string[]) {
  const ui = useUi.getState()
  if (ids.length === 0) return ui.setSelection(null)
  if (ids.length === 1) return ui.setSelection({ type: 'object', id: ids[0] })
  // se gli oggetti formano esattamente un gruppo, si seleziona il gruppo
  const p = useProject.getState().project
  const groupId = p.objects.find((o) => o.id === ids[0])?.groupId
  const members = groupId ? p.objects.filter((o) => o.groupId === groupId) : []
  if (groupId && members.length === ids.length && members.every((m) => ids.includes(m.id))) return ui.setSelection({ type: 'group', id: groupId })
  ui.setSelection({ type: 'multi', ids })
}

/** Clic su un oggetto. Con `wholeGroup` un oggetto in gruppo seleziona tutto il gruppo; con `additive` (Ctrl/Shift) si aggiunge o toglie */
export function selectObject(id: string, opts: { additive?: boolean; wholeGroup?: boolean } = {}) {
  const p = useProject.getState().project
  const o = p.objects.find((x) => x.id === id)
  if (!o) return
  const unit = opts.wholeGroup && o.groupId ? p.objects.filter((x) => x.groupId === o.groupId).map((x) => x.id) : [id]
  if (!opts.additive) return setObjectSelection(unit)
  const current = selectedObjectIds()
  const allIn = unit.every((u) => current.includes(u))
  setObjectSelection(allIn ? current.filter((x) => !unit.includes(x)) : [...current, ...unit.filter((u) => !current.includes(u))])
}

export function selectAllObjects() {
  setObjectSelection(useProject.getState().project.objects.map((o) => o.id))
}

// ---------- gruppi ----------

/** I gruppi restano anche se vuoti (si possono riempire trascinando); qui si tolgono solo i riferimenti orfani */
function pruneGroups(d: Draft<Project>) {
  const ids = new Set(d.groups.map((g) => g.id))
  for (const o of d.objects) if (o.groupId && !ids.has(o.groupId)) o.groupId = null
}

/** Nuovo gruppo vuoto (o con gli oggetti selezionati, se ce ne sono) */
export function createGroup() {
  const ids = selectedObjectIds()
  const id = nanoid()
  mutate((d) => {
    d.groups.push({ id, name: `${getT().props.group} ${d.groups.length + 1}` })
    for (const o of d.objects) if (ids.includes(o.id)) o.groupId = id
  })
  useUi.getState().setSelection({ type: 'group', id })
}

/**
 * Sposta oggetti nella lista: prima di `beforeId` (riordino) e/o dentro `groupId`
 * (null = fuori da ogni gruppo). Senza `beforeId` vanno in fondo.
 */
export function moveObjectsInList(ids: string[], target: { groupId: string | null; beforeId?: string }) {
  if (ids.length === 0 || (target.beforeId && ids.includes(target.beforeId))) return
  mutate((d) => {
    const moving = d.objects.filter((o) => ids.includes(o.id))
    const rest = d.objects.filter((o) => !ids.includes(o.id))
    for (const o of moving) o.groupId = target.groupId
    const at = target.beforeId ? rest.findIndex((o) => o.id === target.beforeId) : -1
    d.objects = at < 0 ? [...rest, ...moving] : [...rest.slice(0, at), ...moving, ...rest.slice(at)]
  })
}

export function groupSelection() {
  const ids = selectedObjectIds()
  if (ids.length < 2) return
  const id = nanoid()
  mutate((d) => {
    d.groups.push({ id, name: `${getT().props.group} ${d.groups.length + 1}` })
    for (const o of d.objects) if (ids.includes(o.id)) o.groupId = id
    pruneGroups(d)
  })
  useUi.getState().setSelection({ type: 'group', id })
}

export function ungroup(groupId: string) {
  const ids = useProject.getState().project.objects.filter((o) => o.groupId === groupId).map((o) => o.id)
  mutate((d) => {
    for (const o of d.objects) if (o.groupId === groupId) o.groupId = null
    d.groups = d.groups.filter((g) => g.id !== groupId)
  })
  // gli oggetti restano selezionati, ma come selezione multipla
  useUi.getState().setSelection(ids.length > 1 ? { type: 'multi', ids } : null)
}

export function ungroupSelection() {
  const sel = useUi.getState().selection
  if (sel?.type === 'group') ungroup(sel.id)
}

export function removeFromGroup(objectId: string) {
  mutate((d) => {
    const o = d.objects.find((x) => x.id === objectId)
    if (o) o.groupId = null
    pruneGroups(d)
  })
}

export function renameGroup(groupId: string, name: string) {
  mutate(
    (d) => {
      const g = d.groups.find((x) => x.id === groupId)
      if (g) g.name = name
    },
    { history: false },
  )
}

// ---------- trasformazioni della selezione ----------

/** Centro dell'ingombro complessivo degli oggetti indicati */
export function centerOf(ids: string[], p: Project = useProject.getState().project): Vec2 {
  const boxes = p.objects.filter((o) => ids.includes(o.id)).map((o) => aabbOf(objectFootprint(o)))
  if (boxes.length === 0) return [0, 0]
  const minX = Math.min(...boxes.map((b) => b.minX))
  const maxX = Math.max(...boxes.map((b) => b.maxX))
  const minZ = Math.min(...boxes.map((b) => b.minZ))
  const maxZ = Math.max(...boxes.map((b) => b.maxZ))
  return [(minX + maxX) / 2, (minZ + maxZ) / 2]
}

/** Applica una modifica a tutti gli oggetti selezionati; con `respectLock` non fa nulla se uno è bloccato */
function editSelected(fn: (o: Draft<SceneObject>, center: Vec2, many: boolean) => void, respectLock = true) {
  const p = useProject.getState().project
  const ids = selectedObjectIds()
  const objs = p.objects.filter((o) => ids.includes(o.id))
  if (objs.length === 0 || (respectLock && objs.some((o) => o.locked))) return
  const center = centerOf(ids, p)
  mutate((d) => {
    for (const o of d.objects) if (ids.includes(o.id)) fn(o, center, objs.length > 1)
  })
}

const normDeg = (v: number) => ((v % 360) + 360) % 360

export function deleteSelection() {
  const sel = useUi.getState().selection
  if (!sel) return
  const ids = selectedObjectIds()
  mutate((d) => {
    if (ids.length) d.objects = d.objects.filter((o) => !ids.includes(o.id))
    if (sel.type === 'wall') {
      d.walls = d.walls.filter((w) => w.id !== sel.id)
      d.openings = d.openings.filter((o) => o.wallId !== sel.id)
    }
    if (sel.type === 'opening') d.openings = d.openings.filter((o) => o.id !== sel.id)
    pruneGroups(d)
  })
  useUi.getState().setSelection(null)
}

export function scaleSelection(k: number) {
  editSelected((o, c, many) => {
    o.size = o.size.map((v) => Math.max(0.01, Math.round(v * k * 1000) / 1000)) as SceneObject['size']
    // con più oggetti si scalano anche le distanze dal centro, così la composizione resta proporzionata
    if (many) o.position = [c[0] + (o.position[0] - c[0]) * k, c[1] + (o.position[1] - c[1]) * k]
  }, false)
}

export function moveSelection(dx: number, dz: number) {
  editSelected((o) => {
    o.position = [o.position[0] + dx, o.position[1] + dz]
  })
}

/** Rotazione attorno all'asse verticale; più oggetti ruotano attorno al loro centro comune */
export function rotateSelection(deg: number) {
  const r = (deg * Math.PI) / 180
  editSelected((o, c, many) => {
    o.rotation = normDeg(o.rotation + deg)
    if (many) {
      // stessa convenzione di three.js per rotation.y
      const dx = o.position[0] - c[0]
      const dz = o.position[1] - c[1]
      o.position = [c[0] + dx * Math.cos(r) + dz * Math.sin(r), c[1] - dx * Math.sin(r) + dz * Math.cos(r)]
    }
  })
}

export function setSelectionLocked(locked: boolean) {
  editSelected((o) => void (o.locked = locked), false)
}

/** Sposta gli oggetti selezionati in modo che il loro centro comune sia `to` */
export function moveSelectionTo(to: Vec2) {
  const c = centerOf(selectedObjectIds())
  moveSelection(to[0] - c[0], to[1] - c[1])
}

export function duplicateSelection() {
  const p = useProject.getState().project
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  // i gruppi copiati restano gruppi (con un nuovo id)
  const groupMap = new Map<string, string>()
  const newGroups: Group[] = []
  const copies = p.objects
    .filter((o) => ids.includes(o.id))
    .map((o): SceneObject => {
      let groupId: string | null = null
      if (o.groupId) {
        if (!groupMap.has(o.groupId)) {
          const g = p.groups.find((x) => x.id === o.groupId)
          groupMap.set(o.groupId, nanoid())
          newGroups.push({ id: groupMap.get(o.groupId)!, name: `${g?.name ?? getT().props.group} (${getT().project.copy})` })
        }
        groupId = groupMap.get(o.groupId)!
      }
      const name = ids.length === 1 ? `${o.name} (${getT().project.copy})` : o.name
      return { ...o, id: nanoid(), name, groupId, position: [o.position[0] + 0.2, o.position[1] + 0.2] }
    })
  mutate((d) => {
    d.objects.push(...copies)
    d.groups.push(...newGroups)
    pruneGroups(d)
  })
  setObjectSelection(copies.map((x) => x.id))
}

export function setUnit(unit: Unit) {
  const prev = useProject.getState().project.unit
  mutate((d) => void (d.unit = unit))
  // cambiando sistema (metrico/imperiale) il passo di aggancio torna a uno adatto
  const system = UNITS[unit].system
  if (UNITS[prev].system !== system) useUi.getState().setSnap(SNAP_STEPS[system][2])
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
