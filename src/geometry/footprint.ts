import type { SceneObject, Vec2, Wall } from '../model/schema'
import { deg2rad, len, normalize, sub } from './vec'

export type Poly = Vec2[]

export interface AABB {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

/**
 * Impronta di un oggetto sul pavimento (rettangolo orientato).
 * Usa la stessa convenzione di three.js per rotation.y.
 */
export function objectFootprint(o: SceneObject): Poly {
  const r = deg2rad(o.rotation)
  const c = Math.cos(r)
  const s = Math.sin(r)
  const hw = o.size[0] / 2
  const hd = o.size[2] / 2
  const corners: Vec2[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
  return corners.map(([x, z]) => [o.position[0] + x * c + z * s, o.position[1] - x * s + z * c])
}

export function rectPoly(minX: number, minZ: number, w: number, d: number): Poly {
  return [
    [minX, minZ],
    [minX + w, minZ],
    [minX + w, minZ + d],
    [minX, minZ + d],
  ]
}

/** Impronta di un muro, estesa di metà spessore alle estremità per chiudere gli angoli */
export function wallFootprint(w: Wall): Poly | null {
  const d = sub(w.b, w.a)
  if (len(d) < 1e-6) return null
  const u = normalize(d)
  const n: Vec2 = [-u[1], u[0]]
  const h = w.thickness / 2
  const a: Vec2 = [w.a[0] - u[0] * h, w.a[1] - u[1] * h]
  const b: Vec2 = [w.b[0] + u[0] * h, w.b[1] + u[1] * h]
  return [
    [a[0] + n[0] * h, a[1] + n[1] * h],
    [b[0] + n[0] * h, b[1] + n[1] * h],
    [b[0] - n[0] * h, b[1] - n[1] * h],
    [a[0] - n[0] * h, a[1] - n[1] * h],
  ]
}

export function aabbOf(p: Poly): AABB {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const [x, z] of p) {
    minX = Math.min(minX, x)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxZ = Math.max(maxZ, z)
  }
  return { minX, minZ, maxX, maxZ }
}

function projectOn(p: Poly, axis: Vec2): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const v of p) {
    const t = v[0] * axis[0] + v[1] * axis[1]
    min = Math.min(min, t)
    max = Math.max(max, t)
  }
  return [min, max]
}

/** Separating Axis Theorem su poligoni convessi; il semplice contatto non è collisione */
export function polysOverlap(p: Poly, q: Poly, eps = 1e-6): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const axis: Vec2 = [-(b[1] - a[1]), b[0] - a[0]]
      const l = Math.hypot(axis[0], axis[1])
      if (l === 0) continue
      const [p0, p1] = projectOn(p, axis)
      const [q0, q1] = projectOn(q, axis)
      if (p1 <= q0 + eps * l || q1 <= p0 + eps * l) return false
    }
  }
  return true
}
