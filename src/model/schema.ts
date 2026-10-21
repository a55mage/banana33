import { z } from 'zod'

// Unità: metri. Piano XZ (Y verso l'alto), angoli in gradi.
export const Vec2Schema = z.tuple([z.number(), z.number()])

export const SceneObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['box', 'cylinder', 'sphere']),
  /** centro dell'impronta sul piano XZ */
  position: Vec2Schema,
  /** quota della base rispetto al pavimento */
  elevation: z.number(),
  /** rotazione attorno all'asse verticale (Y) */
  rotation: z.number(),
  /** inclinazioni attorno agli assi X e Z dell'oggetto; il punto più basso resta alla quota */
  rotationX: z.number().default(0),
  rotationZ: z.number().default(0),
  /** larghezza (X), altezza (Y), profondità (Z) */
  size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  /** dimensioni con cui l'oggetto è stato creato (per il reset); null nei progetti più vecchi */
  defaultSize: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).nullable().default(null),
  /** proporzioni bloccate: cambiando una dimensione si scalano anche le altre */
  scaleLock: z.boolean().default(false),
  color: z.string(),
  /** se bloccato non viene spostato dalla disposizione automatica */
  locked: z.boolean().default(false),
  /** rotazione bloccata: la disposizione automatica può spostarlo ma non ruotarlo */
  rotationLock: z.boolean().default(false),
  /** modello 3D di arredo (vedi model/furniture.ts); null = primitiva semplice */
  model: z.string().nullable().default(null),
  /** gruppo di appartenenza (gli oggetti di un gruppo si selezionano e muovono insieme) */
  groupId: z.string().nullable().default(null),
})

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const WallSchema = z.object({
  id: z.string(),
  a: Vec2Schema,
  b: Vec2Schema,
  thickness: z.number().positive(),
  height: z.number().positive(),
})

export const OpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  kind: z.enum(['door', 'window']),
  /** distanza del centro dell'apertura dall'estremo `a` del muro */
  offset: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** altezza del davanzale (0 per le porte) */
  sill: z.number().min(0),
})

/** Contenitore rettangolare con origine in (0,0): usato per la verifica di ingombro */
export const SpaceSchema = z.object({
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
})

/** Tipo di progetto, scelto alla creazione e non più modificabile */
export const ProjectKindSchema = z.enum(['space', 'plan', 'model'])

const DEFAULT_SPACE = { width: 4, depth: 3, height: 2.7 }

/**
 * Migrazione: i progetti salvati prima del campo `kind` erano "spazio" se avevano il
 * contenitore, "planimetria" altrimenti. Un progetto spazio ha sempre il contenitore.
 */
function migrateProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const p = raw as Record<string, unknown>
  const kind = p.kind ?? (p.space ? 'space' : 'plan')
  const space = kind === 'space' ? (p.space ?? DEFAULT_SPACE) : kind === 'plan' ? null : (p.space ?? null)
  return { ...p, kind, space }
}

const ProjectObjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  kind: ProjectKindSchema,
  /** unità di misura mostrata nell'interfaccia (i dati restano in metri) */
  unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']).default('cm'),
  space: SpaceSchema.nullable(),
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  objects: z.array(SceneObjectSchema),
  groups: z.array(GroupSchema).default([]),
})

export const ProjectSchema = z.preprocess(migrateProject, ProjectObjectSchema)

export type Vec2 = z.infer<typeof Vec2Schema>
export type SceneObject = z.infer<typeof SceneObjectSchema>
export type PrimitiveKind = SceneObject['kind']
export type Group = z.infer<typeof GroupSchema>
export type Wall = z.infer<typeof WallSchema>
export type Opening = z.infer<typeof OpeningSchema>
export type OpeningKind = Opening['kind']
export type Unit = Project['unit']
export type Space =z.infer<typeof SpaceSchema>
export type Project = z.infer<typeof ProjectObjectSchema>
export type ProjectKind = z.infer<typeof ProjectKindSchema>

export function parseProject(data: unknown): Project {
  return ProjectSchema.parse(data)
}
