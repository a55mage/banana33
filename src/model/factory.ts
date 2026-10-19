import { nanoid } from 'nanoid'
import type { OpeningKind, PrimitiveKind, Project, SceneObject } from './schema'
import { getT, type Dict } from '../i18n'

export type ProjectTemplate = 'space' | 'plan'

export function newProject(template: ProjectTemplate): Project {
  const now = Date.now()
  return {
    schemaVersion: 1,
    id: nanoid(),
    name: template === 'space' ? getT().project.newSpace : getT().project.newPlan,
    createdAt: now,
    updatedAt: now,
    unit: 'cm',
    space: template === 'space' ? { width: 4, depth: 3, height: 2.7 } : null,
    walls: [],
    openings: [],
    objects: [],
    groups: [],
  }
}

export interface Preset {
  /** chiave del nome tradotto (i18n presets) e dell'icona */
  id: PresetId
  kind: PrimitiveKind
  size: [number, number, number]
  color: string
  /** modello di arredo (model/furniture.ts) */
  model?: string
}

export type PresetId = keyof Dict['presets']
export type GroupId = keyof Dict['groups']

export interface PresetGroup {
  id: GroupId
  presets: Preset[]
}

export const PRIMITIVES: Preset[] = [
  { id: 'cube', kind: 'box', size: [0.5, 0.5, 0.5], color: '#9db4c0' },
  { id: 'cylinder', kind: 'cylinder', size: [0.5, 0.8, 0.5], color: '#c2b280' },
  { id: 'sphere', kind: 'sphere', size: [0.5, 0.5, 0.5], color: '#d4a5a5' },
]

const f = (id: PresetId, model: string, size: [number, number, number], color: string, kind: PrimitiveKind = 'box'): Preset => ({
  id,
  model,
  size,
  color,
  kind,
})

/** Arredo, suddiviso per ambiente */
export const FURNITURE: PresetGroup[] = [
  {
    id: 'living',
    presets: [
      f('sofa3', 'sofa', [2.2, 0.85, 0.9], '#7f9a7f'),
      f('sofa2', 'sofa', [1.6, 0.85, 0.9], '#7f9a7f'),
      f('armchair', 'armchair', [0.85, 0.85, 0.85], '#a3876a'),
      f('coffeeTable', 'coffeeTable', [1.1, 0.42, 0.6], '#c9a77c'),
      f('tvStand', 'tvStand', [1.6, 0.5, 0.42], '#e6e0d4'),
      f('tv', 'tv', [1.23, 0.78, 0.25], '#2a2a2c'),
      f('bookshelf', 'bookshelf', [0.9, 2.0, 0.35], '#d8c3a0'),
      f('rug', 'rug', [2.0, 0.01, 1.4], '#b7695c'),
      f('plant', 'plant', [0.5, 1.2, 0.5], '#5d8f4e', 'cylinder'),
      f('floorLamp', 'floorLamp', [0.4, 1.7, 0.4], '#f3e7c4', 'cylinder'),
    ],
  },
  {
    id: 'bedroom',
    presets: [
      f('bedDouble', 'bed', [1.6, 0.9, 2.1], '#8fa6c4'),
      f('bedSingle', 'bed', [0.95, 0.9, 2.05], '#8fa6c4'),
      f('nightstand', 'nightstand', [0.5, 0.5, 0.4], '#c9a77c'),
      f('wardrobe', 'wardrobe', [2.0, 2.4, 0.6], '#e6e0d4'),
      f('dresser', 'dresser', [1.0, 0.85, 0.5], '#c9a77c'),
    ],
  },
  {
    id: 'kitchen',
    presets: [
      f('kitchen', 'kitchen', [2.4, 0.9, 0.6], '#8a8178'),
      f('kitchenBase', 'kitchen', [0.6, 0.9, 0.6], '#8a8178'),
      f('fridge', 'fridge', [0.6, 1.85, 0.65], '#f0f0ee'),
      f('table', 'table', [1.6, 0.75, 0.9], '#c9a77c'),
      f('roundTable', 'roundTable', [1.1, 0.75, 1.1], '#c9a77c', 'cylinder'),
      f('chair', 'chair', [0.45, 0.9, 0.5], '#a68a64'),
    ],
  },
  {
    id: 'bathroom',
    presets: [
      f('toilet', 'toilet', [0.38, 0.8, 0.65], '#f7f7f5'),
      f('washbasin', 'washbasin', [0.6, 0.97, 0.46], '#c9a77c'),
      f('bathtub', 'bathtub', [1.7, 0.55, 0.75], '#f7f7f5'),
      f('shower', 'shower', [0.9, 2.0, 0.9], '#f7f7f5'),
      f('washer', 'washer', [0.6, 0.85, 0.6], '#f0f0ee'),
    ],
  },
  {
    id: 'office',
    presets: [f('desk', 'desk', [1.4, 0.75, 0.7], '#d8c3a0'), f('officeChair', 'chair', [0.45, 0.9, 0.5], '#4a4f57')],
  },
  {
    id: 'storage',
    presets: [f('pallet', 'pallet', [1.2, 0.144, 0.8], '#d2b48c'), f('carton', 'carton', [0.6, 0.4, 0.4], '#c8a165')],
  },
  {
    id: 'garden',
    presets: [
      f('tree', 'tree', [2.5, 4.5, 2.5], '#5f9a3a', 'cylinder'),
      f('pine', 'pine', [2, 6, 2], '#2f6b3a', 'cylinder'),
      f('bush', 'bush', [1, 0.9, 0.9], '#4f8a35'),
      f('hedge', 'hedge', [3, 1.4, 0.6], '#3f7a32'),
      f('pool', 'pool', [8, 0.12, 4], '#3fb6d9'),
      f('gazebo', 'gazebo', [3, 2.9, 3], '#8a5a3c'),
      f('parasol', 'parasol', [2.4, 2.4, 2.4], '#f2e318', 'cylinder'),
      f('lounger', 'lounger', [0.65, 0.85, 1.9], '#8abc40'),
      f('bench', 'bench', [1.5, 0.82, 0.6], '#9c6b43'),
      f('bbq', 'bbq', [0.6, 1.0, 0.6], '#2a2a2c', 'cylinder'),
      f('dog', 'dog', [0.85, 0.65, 0.3], '#b07a45'),
      f('cat', 'cat', [0.45, 0.3, 0.16], '#8a8580'),
      f('pigeon', 'pigeon', [0.3, 0.25, 0.12], '#9aa3a8'),
    ],
  },
  {
    id: 'misc',
    // banana33: la banana di default è lunga 33 cm
    presets: [f('banana', 'banana', [0.33, 0.075, 0.115], '#f2d43d')],
  },
]

/** Dimensioni originali di un oggetto: quelle salvate, altrimenti quelle del preset corrispondente */
export function defaultSizeOf(o: SceneObject): SceneObject['size'] {
  if (o.defaultSize) return [...o.defaultSize]
  const all = [...PRIMITIVES, ...FURNITURE.flatMap((g) => g.presets)]
  const preset = o.model ? all.find((p) => p.model === o.model) : PRIMITIVES.find((p) => p.kind === o.kind)
  return [...(preset ?? PRIMITIVES[0]).size]
}

export function newObject(preset: Preset, position: [number, number]): SceneObject {
  const name = getT().presets[preset.id]
  return {
    id: nanoid(),
    name,
    kind: preset.kind,
    position,
    elevation: 0,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    size: [...preset.size],
    defaultSize: [...preset.size],
    scaleLock: false,
    color: preset.color,
    locked: false,
    model: preset.model ?? null,
    groupId: null,
  }
}

/** Preset per id (per costruire scene di esempio) */
function presetById(id: PresetId): Preset {
  return [...PRIMITIVES, ...FURNITURE.flatMap((g) => g.presets)].find((p) => p.id === id)!
}

/** Oggetto da preset con posizione, rotazione e quota già impostate */
function placed(id: PresetId, position: [number, number], rotation = 0, elevation = 0): SceneObject {
  return { ...newObject(presetById(id), position), rotation, elevation }
}

/** Stesso oggetto, scalato in proporzione fino alla lunghezza (X) indicata */
function giant(o: SceneObject, length: number): SceneObject {
  const k = length / o.size[0]
  return { ...o, size: o.size.map((v) => Math.round(v * k * 1000) / 1000) as SceneObject['size'], scaleLock: true }
}

/**
 * Scena di benvenuto: una stanza 5×4 m con porta e finestra, divano, tappeto, tavolo,
 * gatto, piccione, pianta, lampada da terra e una banana gigante.
 */
export function sampleProject(): Project {
  const p = newProject('plan')
  p.name = getT().project.sample
  const corners: [number, number][] = [
    [0, 0],
    [5, 0],
    [5, 4],
    [0, 4],
  ]
  p.walls = corners.map((a, i) => ({ id: nanoid(), a, b: corners[(i + 1) % 4], ...WALL_DEFAULTS }))
  const [, east, south] = p.walls
  p.openings = [
    // porta sulla parete sud (da (5,4) verso (0,4)), finestra sulla parete est
    { id: nanoid(), wallId: south.id, kind: 'door', offset: 4, ...OPENING_DEFAULTS.door },
    { id: nanoid(), wallId: east.id, kind: 'window', offset: 2, ...OPENING_DEFAULTS.window },
  ]
  p.objects = [
    placed('rug', [2.1, 1.9]),
    placed('sofa3', [2.1, 0.62]),
    placed('table', [4.2, 2.2], 90),
    // il gatto riposa sul tappeto (alto 1 cm)
    placed('cat', [2.4, 2.2], 30, 0.01),
    placed('pigeon', [4.4, 0.6], 210),
    placed('plant', [0.5, 0.5]),
    placed('floorLamp', [3.55, 0.45]),
    // banana gigante (1,8 m) sul pavimento; il reset la riporta ai 33 cm del preset
    giant(placed('banana', [2.6, 3.3], 10), 1.8),
  ]
  return p
}

export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
}

export const WALL_DEFAULTS = { thickness: 0.15, height: 2.7 }
