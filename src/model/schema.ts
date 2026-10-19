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
  /** rotazione attorno all'asse verticale */
  rotation: z.number(),
  /** larghezza (X), altezza (Y), profondità (Z) */
  size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  color: z.string(),
  /** se bloccato non viene spostato dalla disposizione automatica */
  locked: z.boolean().default(false),
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

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  space: SpaceSchema.nullable(),
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  objects: z.array(SceneObjectSchema),
})

export type Vec2 = z.infer<typeof Vec2Schema>
export type SceneObject = z.infer<typeof SceneObjectSchema>
export type PrimitiveKind = SceneObject['kind']
export type Wall = z.infer<typeof WallSchema>
export type Opening = z.infer<typeof OpeningSchema>
export type OpeningKind = Opening['kind']
export type Space = z.infer<typeof SpaceSchema>
export type Project = z.infer<typeof ProjectSchema>

export function parseProject(data: unknown): Project {
  return ProjectSchema.parse(data)
}
