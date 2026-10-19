import type { SceneObject, Vec2, Wall } from '../model/schema'
import { deg2rad, len, normalize, sub } from './vec'

export type Poly = Vec2[]

export interface AABB {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

type V3 = [number, number, number]

/** Rotazione Euler in ordine 'YXZ' come three.js: prima Z, poi X, infine Y (gradi) */
export function rotateEuler([x, y, z]: V3, rxDeg: number, ryDeg: number, rzDeg: number): V3 {
  const [rx, ry, rz] = [deg2rad(rxDeg), deg2rad(ryDeg), deg2rad(rzDeg)]
  const x1 = x * Math.cos(rz) - y * Math.sin(rz)
  const y1 = x * Math.sin(rz) + y * Math.cos(rz)
  const y2 = y1 * Math.cos(rx) - z * Math.sin(rx)
  const z2 = y1 * Math.sin(rx) + z * Math.cos(rx)
  return [x1 * Math.cos(ry) + z2 * Math.sin(ry), y2, -x1 * Math.sin(ry) + z2 * Math.cos(ry)]
}

/** Inviluppo convesso (monotone chain) */
function convexHull(points: Vec2[]): Poly {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Vec2[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop()
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

export interface ObjectExtents {
  /** impronta sul pavimento (poligono convesso) */
  footprint: Poly
  /** ingombro verticale dell'oggetto ruotato */
  height: number
  /** quota del centro del parallelepipedo rispetto alla quota dell'oggetto */
  centerY: number
}

const extentsCache = new WeakMap<SceneObject, ObjectExtents>()

/**
 * Ingombro di un oggetto ruotato sui tre assi. Il parallelepipedo ruota attorno al suo centro
 * e viene appoggiato in modo che il punto più basso stia alla quota `elevation`.
 */
export function objectExtents(o: SceneObject): ObjectExtents {
  const cached = extentsCache.get(o)
  if (cached) return cached
  const [w, h, d] = o.size
  const corners: V3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([(sx * w) / 2, (sy * h) / 2, (sz * d) / 2])
  const rotated = corners.map((c) => rotateEuler(c, o.rotationX, o.rotation, o.rotationZ))
  const ys = rotated.map((c) => c[1])
  const minY = Math.min(...ys)
  const footprint = convexHull(rotated.map(([x, , z]) => [o.position[0] + x, o.position[1] + z] as Vec2))
  const res: ObjectExtents = { footprint, height: Math.max(...ys) - minY, centerY: -minY }
  extentsCache.set(o, res)
  return res
}

/** Impronta di un oggetto sul pavimento (poligono convesso, anche se inclinato) */
export function objectFootprint(o: SceneObject): Poly {
  return objectExtents(o).footprint
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
