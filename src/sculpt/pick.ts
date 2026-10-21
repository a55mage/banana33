import { Vector3 } from 'three'
import { evaluateSculpt, shapeDistance, type CompiledItem, type CompiledShape, type CompiledSculpt } from './compile'
import type { V3 } from './sdf'

export interface PickHit {
  point: V3
  distance: number
  /** forma la cui superficie è più vicina al punto colpito */
  nodeId: string
}

function shapesOf(items: CompiledItem[], out: CompiledShape[] = []): CompiledShape[] {
  for (const it of items) {
    if (it.type === 'shape') out.push(it)
    else shapesOf(it.children, out)
  }
  return out
}

/**
 * Ray marching in TypeScript, con gli stessi passi dello shader. Restituisce il punto colpito e la
 * forma responsabile: quella la cui superficie (non combinata) passa più vicino al punto.
 * Così cliccando una superficie scavata si seleziona la forma che scava, come in Womp.
 */
export function pickSculpt(c: CompiledSculpt, origin: V3, dir: V3, maxDistance = 100): PickHit | null {
  if (!c.bounds) return null
  const o = new Vector3(...origin)
  const d = new Vector3(...dir).normalize()
  // salto fino all'ingombro del modello
  const inv = [1 / d.x, 1 / d.y, 1 / d.z]
  let tmin = -Infinity
  let tmax = Infinity
  for (let i = 0; i < 3; i++) {
    const a = (c.bounds.min[i] - origin[i]) * inv[i]
    const b = (c.bounds.max[i] - origin[i]) * inv[i]
    tmin = Math.max(tmin, Math.min(a, b))
    tmax = Math.min(tmax, Math.max(a, b))
  }
  if (tmin > tmax || tmax < 0) return null
  let t = Math.max(tmin, 0)
  const end = Math.min(tmax, maxDistance)
  let hit = false
  for (let i = 0; i < 300 && t <= end; i++) {
    const p = o.clone().addScaledVector(d, t)
    const h = evaluateSculpt(c, [p.x, p.y, p.z]).d
    const eps = 0.00015 * Math.max(t, 0.5)
    if (h < eps) {
      hit = true
      break
    }
    t += Math.max(h * 0.9, eps * 0.5)
  }
  if (!hit) return null

  const p = o.clone().addScaledVector(d, t)
  const sym = c.symmetry
  const q = new Vector3(sym.x ? Math.abs(p.x) : p.x, sym.y ? Math.abs(p.y) : p.y, sym.z ? Math.abs(p.z) : p.z)
  let best: CompiledShape | null = null
  let bestD = Infinity
  for (const s of shapesOf(c.items)) {
    const dist = Math.abs(shapeDistance(s, q))
    if (dist < bestD) {
      bestD = dist
      best = s
    }
  }
  return best ? { point: [p.x, p.y, p.z], distance: t, nodeId: best.nodeId } : null
}
