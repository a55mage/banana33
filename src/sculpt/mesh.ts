import { evaluateSculpt, type CompiledItem, type CompiledSculpt } from './compile'
import { FAR, opShell, sdShape, type V3 } from './sdf'

/*
 * Estrazione della superficie del modello come mesh di triangoli ("surface nets"):
 *  1. si campiona la distanza su una griglia regolare che racchiude il modello;
 *  2. in ogni cella attraversata dalla superficie si mette un vertice (media dei punti in cui
 *     la superficie taglia gli spigoli), poi lo si riporta sulla superficie con un passo di Newton;
 *  3. per ogni spigolo della griglia che cambia segno si crea un quadrilatero tra le 4 celle che
 *     lo condividono, orientato verso l'esterno.
 * Il risultato è una mesh chiusa con un vertice per cella, adatta alla stampa 3D.
 */

export interface SculptMesh {
  positions: Float32Array
  normals: Float32Array
  /** colori lineari per vertice */
  colors: Float32Array
  indices: Uint32Array
}

export type Progress = (fraction: number) => void

/** Celle sul lato più lungo del modello per ciascuna qualità di esportazione */
export const QUALITY = { draft: 80, medium: 128, high: 200 } as const
export type Quality = keyof typeof QUALITY

/**
 * Spigoli non "chiusi" (non condivisi da esattamente due triangoli con versi opposti).
 * Compaiono dove il modello è più sottile di una cella: con una qualità più alta spariscono.
 */
export function nonManifoldEdges(m: SculptMesh): number {
  const edges = new Map<number, number>()
  const n = m.positions.length / 3
  const tri = m.indices
  for (let t = 0; t < tri.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const key = tri[t + e] * n + tri[t + ((e + 1) % 3)]
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  let bad = 0
  for (const [key, count] of edges) {
    const a = Math.floor(key / n)
    const b = key % n
    if (count !== 1 || edges.get(b * n + a) !== 1) bad++
  }
  return bad
}

/** Distanza veloce (senza colore né allocazioni), con le stesse formule della valutazione completa */
export function distanceFunction(c: CompiledSculpt): (x: number, y: number, z: number) => number {
  const q: V3 = [0, 0, 0]
  const K_MIN = 1e-5
  const union = (a: number, b: number, k: number) => {
    k = Math.max(k, K_MIN)
    const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k))
    return b + (a - b) * h - k * h * (1 - h)
  }
  const subtract = (a: number, b: number, k: number) => {
    k = Math.max(k, K_MIN)
    const h = Math.min(1, Math.max(0, 0.5 - (0.5 * (a + b)) / k))
    return a + (-b - a) * h + k * h * (1 - h)
  }
  const intersect = (a: number, b: number, k: number) => {
    k = Math.max(k, K_MIN)
    const h = Math.min(1, Math.max(0, 0.5 - (0.5 * (b - a)) / k))
    return b + (a - b) * h + k * h * (1 - h)
  }
  const OPS = { add: union, subtract, intersect }

  const build = (items: CompiledItem[]): ((x: number, y: number, z: number) => number) => {
    const parts = items.map((it) => {
      const op = OPS[it.op]
      if (it.type === 'group') {
        const inner = build(it.children)
        return { op, k: it.blend, f: (x: number, y: number, z: number) => opShell(inner(x, y, z), it.shell) }
      }
      const e = it.inv.elements
      const { shape, size, round, distScale, mirrors, shell } = it
      const f = (x: number, y: number, z: number) => {
        let d = FAR
        for (const s of mirrors) {
          const px = x * s[0]
          const py = y * s[1]
          const pz = z * s[2]
          q[0] = e[0] * px + e[4] * py + e[8] * pz + e[12]
          q[1] = e[1] * px + e[5] * py + e[9] * pz + e[13]
          q[2] = e[2] * px + e[6] * py + e[10] * pz + e[14]
          d = Math.min(d, sdShape(shape, q, size, round) * distScale)
        }
        return opShell(d, shell)
      }
      return { op, k: it.blend, f }
    })
    return (x, y, z) => {
      let acc = FAR
      for (const p of parts) acc = p.op(acc, p.f(x, y, z), p.k)
      return acc
    }
  }

  const root = build(c.items)
  const sym = c.symmetry
  return (x, y, z) => root(sym.x ? Math.abs(x) : x, sym.y ? Math.abs(y) : y, sym.z ? Math.abs(z) : z)
}

/**
 * Mesh del modello con `resolution` celle sul lato più lungo dell'ingombro.
 * Restituisce null se il modello è vuoto.
 */
export function meshSculpt(c: CompiledSculpt, resolution: number, onProgress?: Progress): SculptMesh | null {
  if (!c.bounds) return null
  const sdf = distanceFunction(c)
  const { min, max } = c.bounds
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  const h = extent / resolution
  // due celle di margine: la superficie non deve toccare il bordo della griglia
  const origin: V3 = [min[0] - 2 * h, min[1] - 2 * h, min[2] - 2 * h]
  const nx = Math.ceil((max[0] - min[0]) / h) + 5
  const ny = Math.ceil((max[1] - min[1]) / h) + 5
  const nz = Math.ceil((max[2] - min[2]) / h) + 5

  // 1. campionamento
  const field = new Float32Array(nx * ny * nz)
  for (let k = 0; k < nz; k++) {
    const z = origin[2] + k * h
    for (let j = 0; j < ny; j++) {
      const y = origin[1] + j * h
      let idx = nx * (j + ny * k)
      for (let i = 0; i < nx; i++) field[idx++] = sdf(origin[0] + i * h, y, z)
    }
    if (onProgress && k % 4 === 0) onProgress((0.8 * k) / nz)
  }
  const at = (i: number, j: number, k: number) => field[i + nx * (j + ny * k)]

  // 2. un vertice per ogni cella attraversata dalla superficie
  const cx = nx - 1
  const cy = ny - 1
  const cz = nz - 1
  const cellVertex = new Int32Array(cx * cy * cz).fill(-1)
  const pos: number[] = []
  const corners: V3[] = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ]
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const v = new Float64Array(8)
  const eps = h * 0.01
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let inside = 0
        for (let c8 = 0; c8 < 8; c8++) {
          const [a, b, d] = corners[c8]
          v[c8] = at(i + a, j + b, k + d)
          if (v[c8] < 0) inside++
        }
        if (inside === 0 || inside === 8) continue
        let sx = 0
        let sy = 0
        let sz = 0
        let n = 0
        for (const [e0, e1] of edges) {
          if (v[e0] < 0 === v[e1] < 0) continue
          const t = v[e0] / (v[e0] - v[e1])
          const p0 = corners[e0]
          const p1 = corners[e1]
          sx += p0[0] + (p1[0] - p0[0]) * t
          sy += p0[1] + (p1[1] - p0[1]) * t
          sz += p0[2] + (p1[2] - p0[2]) * t
          n++
        }
        let x = origin[0] + (i + sx / n) * h
        let y = origin[1] + (j + sy / n) * h
        let z = origin[2] + (k + sz / n) * h
        // passo di Newton verso la superficie, restando dentro la cella
        const d = sdf(x, y, z)
        const gx = (sdf(x + eps, y, z) - sdf(x - eps, y, z)) / (2 * eps)
        const gy = (sdf(x, y + eps, z) - sdf(x, y - eps, z)) / (2 * eps)
        const gz = (sdf(x, y, z + eps) - sdf(x, y, z - eps)) / (2 * eps)
        const g2 = gx * gx + gy * gy + gz * gz
        if (g2 > 1e-12) {
          const x0 = origin[0] + i * h
          const y0 = origin[1] + j * h
          const z0 = origin[2] + k * h
          x = Math.min(x0 + h, Math.max(x0, x - (d * gx) / g2))
          y = Math.min(y0 + h, Math.max(y0, y - (d * gy) / g2))
          z = Math.min(z0 + h, Math.max(z0, z - (d * gz) / g2))
        }
        cellVertex[i + cx * (j + cy * k)] = pos.length / 3
        pos.push(x, y, z)
      }
    }
    if (onProgress && k % 4 === 0) onProgress(0.8 + (0.1 * k) / cz)
  }

  // 3. un quadrilatero (due triangoli) per ogni spigolo della griglia che cambia segno
  const idx: number[] = []
  const cell = (i: number, j: number, k: number) => cellVertex[i + cx * (j + cy * k)]
  const quad = (a: number, b: number, c2: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c2 < 0 || d < 0) return
    if (flip) idx.push(a, c2, b, a, d, c2)
    else idx.push(a, b, c2, a, c2, d)
  }
  for (let k = 1; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 1; i < cx; i++) {
        const v0 = at(i, j, k) < 0
        // spigolo lungo X da (i,j,k): celle attorno nel piano YZ
        if (v0 !== at(i + 1, j, k) < 0) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !v0)
        // spigolo lungo Y: celle attorno nel piano ZX
        if (v0 !== at(i, j + 1, k) < 0) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !v0)
        // spigolo lungo Z: celle attorno nel piano XY
        if (v0 !== at(i, j, k + 1) < 0) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !v0)
      }
    }
  }

  // normali dal gradiente e colori dal modello completo, vertice per vertice
  const count = pos.length / 3
  const positions = new Float32Array(pos)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let n = 0; n < count; n++) {
    const x = positions[n * 3]
    const y = positions[n * 3 + 1]
    const z = positions[n * 3 + 2]
    const gx = sdf(x + eps, y, z) - sdf(x - eps, y, z)
    const gy = sdf(x, y + eps, z) - sdf(x, y - eps, z)
    const gz = sdf(x, y, z + eps) - sdf(x, y, z - eps)
    const l = Math.hypot(gx, gy, gz) || 1
    normals.set([gx / l, gy / l, gz / l], n * 3)
    colors.set(evaluateSculpt(c, [x, y, z]).c, n * 3)
    if (onProgress && n % 2000 === 0) onProgress(0.9 + (0.1 * n) / count)
  }
  onProgress?.(1)
  return { positions, normals, colors, indices: new Uint32Array(idx) }
}
