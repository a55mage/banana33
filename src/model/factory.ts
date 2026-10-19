import { nanoid } from 'nanoid'
import type { OpeningKind, PrimitiveKind, Project, SceneObject } from './schema'

export type ProjectTemplate = 'space' | 'plan'

export function newProject(template: ProjectTemplate): Project {
  const now = Date.now()
  return {
    schemaVersion: 1,
    id: nanoid(),
    name: template === 'space' ? 'Nuovo spazio' : 'Nuova planimetria',
    createdAt: now,
    updatedAt: now,
    space: template === 'space' ? { width: 4, depth: 3, height: 2.7 } : null,
    walls: [],
    openings: [],
    objects: [],
  }
}

export interface Preset {
  label: string
  kind: PrimitiveKind
  size: [number, number, number]
  color: string
}

export const PRIMITIVES: Preset[] = [
  { label: 'Cubo', kind: 'box', size: [0.5, 0.5, 0.5], color: '#9db4c0' },
  { label: 'Cilindro', kind: 'cylinder', size: [0.5, 0.8, 0.5], color: '#c2b280' },
  { label: 'Sfera', kind: 'sphere', size: [0.5, 0.5, 0.5], color: '#d4a5a5' },
]

export const PRESETS: Preset[] = [
  { label: 'Letto 160×200', kind: 'box', size: [1.6, 0.5, 2.0], color: '#b8c4d6' },
  { label: 'Letto 90×200', kind: 'box', size: [0.9, 0.5, 2.0], color: '#b8c4d6' },
  { label: 'Divano', kind: 'box', size: [2.2, 0.85, 0.9], color: '#8fa98f' },
  { label: 'Tavolo', kind: 'box', size: [1.6, 0.75, 0.9], color: '#c9a77c' },
  { label: 'Tavolo tondo', kind: 'cylinder', size: [1.1, 0.75, 1.1], color: '#c9a77c' },
  { label: 'Sedia', kind: 'box', size: [0.45, 0.9, 0.45], color: '#a68a64' },
  { label: 'Armadio', kind: 'box', size: [2.0, 2.4, 0.6], color: '#e0d6c3' },
  { label: 'Scrivania', kind: 'box', size: [1.4, 0.75, 0.7], color: '#c9a77c' },
  { label: 'Pallet EUR', kind: 'box', size: [1.2, 0.15, 0.8], color: '#d2b48c' },
  { label: 'Scatolone', kind: 'box', size: [0.6, 0.4, 0.4], color: '#c8a165' },
]

export function newObject(preset: Preset, position: [number, number]): SceneObject {
  return {
    id: nanoid(),
    name: preset.label,
    kind: preset.kind,
    position,
    elevation: 0,
    rotation: 0,
    size: [...preset.size],
    color: preset.color,
    locked: false,
  }
}

export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
}

export const WALL_DEFAULTS = { thickness: 0.15, height: 2.7 }
