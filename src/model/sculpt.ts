import { z } from 'zod'
import { nanoid } from 'nanoid'

/*
 * Documento di un progetto "Modello 3D": un albero di forme combinate come campi di distanza (SDF).
 * L'albero è salvato piatto (ogni nodo conosce il genitore); l'ordine nell'array conta: ogni nodo
 * si combina con il risultato dei fratelli che lo precedono, come i livelli di Womp.
 * Unità: metri; rotazioni in gradi, ordine Euler 'YXZ' come nel resto dell'app.
 */

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()])
export type Vec3 = z.infer<typeof Vec3Schema>

/**
 * Forme disponibili. `size` è l'ingombro sui tre assi: la sfera con dimensioni diverse è un
 * ellissoide; cilindro, cono e capsula hanno l'asse lungo Y; il toro giace sul piano XZ
 * (X/Z = diametro esterno, Y = spessore dell'anello).
 */
export const SculptShapeSchema = z.enum(['sphere', 'box', 'cylinder', 'cone', 'torus', 'capsule'])
export type SculptShape = z.infer<typeof SculptShapeSchema>

/** Come un nodo si combina con quelli che lo precedono */
export const SculptOpSchema = z.enum(['add', 'subtract', 'intersect'])
export type SculptOp = z.infer<typeof SculptOpSchema>

export const SculptNodeSchema = z.object({
  id: z.string(),
  /** gruppo che contiene il nodo; null = radice */
  parentId: z.string().nullable().default(null),
  kind: z.union([z.literal('group'), SculptShapeSchema]),
  name: z.string(),
  op: SculptOpSchema.default('add'),
  /** raggio di fusione con i nodi precedenti (il "goop" di Womp); 0 = spigolo vivo */
  blend: z.number().min(0).default(0.02),
  /** arrotondamento degli spigoli della forma */
  round: z.number().min(0).default(0),
  position: Vec3Schema.default([0, 0, 0]),
  rotation: Vec3Schema.default([0, 0, 0]),
  /** dimensioni della forma; per i gruppi è un fattore di scala dei figli */
  size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([0.2, 0.2, 0.2]),
  color: z.string().default('#f2d43d'),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
})
export type SculptNode = z.infer<typeof SculptNodeSchema>

export const SculptMaterialSchema = z.enum(['matte', 'glossy', 'metal', 'clay'])
export type SculptMaterial = z.infer<typeof SculptMaterialSchema>

export const SculptDocSchema = z.object({
  nodes: z.array(SculptNodeSchema).default([]),
  material: SculptMaterialSchema.default('glossy'),
  /** simmetria globale: il modello viene specchiato sui piani indicati */
  symmetry: z
    .object({ x: z.boolean().default(false), y: z.boolean().default(false), z: z.boolean().default(false) })
    .default({ x: false, y: false, z: false }),
})
export type SculptDoc = z.infer<typeof SculptDocSchema>

/** Dimensioni iniziali delle forme (m): oggetti "da tavolo", come in Womp */
export const SHAPE_DEFAULTS: Record<SculptShape, Vec3> = {
  sphere: [0.2, 0.2, 0.2],
  box: [0.2, 0.2, 0.2],
  cylinder: [0.16, 0.2, 0.16],
  cone: [0.2, 0.24, 0.2],
  torus: [0.24, 0.06, 0.24],
  capsule: [0.1, 0.24, 0.1],
}

export function newSculptNode(kind: SculptNode['kind'], patch: Partial<SculptNode> = {}): SculptNode {
  const size: Vec3 = kind === 'group' ? [1, 1, 1] : [...SHAPE_DEFAULTS[kind]]
  return SculptNodeSchema.parse({
    id: nanoid(),
    kind,
    name: kind,
    // le forme nascono appoggiate sul piano (y = metà altezza)
    position: [0, kind === 'group' ? 0 : size[1] / 2, 0],
    size,
    ...patch,
  })
}

export function emptySculptDoc(): SculptDoc {
  return SculptDocSchema.parse({})
}

// ---------- navigazione dell'albero ----------

/** Figli diretti di un nodo (o della radice), nell'ordine di combinazione */
export function childrenOf(doc: SculptDoc, parentId: string | null): SculptNode[] {
  return doc.nodes.filter((n) => n.parentId === parentId)
}

/** Id di un nodo e di tutti i suoi discendenti */
export function subtreeIds(doc: SculptDoc, id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const n of doc.nodes) if (n.parentId === out[i]) out.push(n.id)
  return out
}

/** Vero se `ancestorId` contiene (anche indirettamente) `id` */
export function isDescendant(doc: SculptDoc, id: string, ancestorId: string): boolean {
  let cur = doc.nodes.find((n) => n.id === id)?.parentId ?? null
  while (cur) {
    if (cur === ancestorId) return true
    cur = doc.nodes.find((n) => n.id === cur)?.parentId ?? null
  }
  return false
}

/**
 * Coerenza dell'albero dopo una modifica: genitori inesistenti o non-gruppi diventano radice,
 * e i nodi restano ordinati con ogni figlio dopo il proprio genitore (ordine stabile).
 */
export function normalizeSculpt(doc: SculptDoc): SculptDoc {
  const groups = new Set(doc.nodes.filter((n) => n.kind === 'group').map((n) => n.id))
  const nodes = doc.nodes.map((n) => (n.parentId && !groups.has(n.parentId) ? { ...n, parentId: null } : n))
  // visita in profondità: genitore, poi i figli nell'ordine originale
  const ordered: SculptNode[] = []
  const visit = (parentId: string | null) => {
    for (const n of nodes) {
      if (n.parentId !== parentId) continue
      ordered.push(n)
      if (n.kind === 'group') visit(n.id)
    }
  }
  visit(null)
  // nodi irraggiungibili (cicli) tornano alla radice
  const seen = new Set(ordered.map((n) => n.id))
  for (const n of nodes) if (!seen.has(n.id)) ordered.push({ ...n, parentId: null })
  return { ...doc, nodes: ordered }
}
