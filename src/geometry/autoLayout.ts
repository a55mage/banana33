import type { Project, Vec2 } from '../model/schema'
import { aabbOf, objectFootprint, polysOverlap, rectPoly, wallFootprint, type AABB, type Poly } from './footprint'

export interface LayoutResult {
  placements: Record<string, { position: Vec2; rotation: number }>
  unplaced: string[]
  error?: string
}

/** Area disponibile: lo spazio, oppure il rettangolo che racchiude i muri */
export function layoutBounds(p: Project): AABB | null {
  if (p.space) return { minX: 0, minZ: 0, maxX: p.space.width, maxZ: p.space.depth }
  const polys = p.walls.map(wallFootprint).filter((x): x is Poly => x !== null)
  if (polys.length === 0) return null
  return polys.map(aabbOf).reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }))
}

/**
 * Disposizione automatica "bottom-left": gli oggetti non bloccati, dal più grande al più
 * piccolo, vanno nella prima posizione libera (ordinando per Z poi X), provando le
 * rotazioni 0° e 90°. Muri e oggetti bloccati sono ostacoli; `gap` è la distanza minima.
 */
export function autoLayout(p: Project, gap = 0.05): LayoutResult {
  const movable = p.objects.filter((o) => !o.locked)
  const bounds = layoutBounds(p)
  if (!bounds) {
    return { placements: {}, unplaced: movable.map((o) => o.id), error: 'Definisci uno spazio o disegna dei muri.' }
  }

  const obstacles: { poly: Poly; box: AABB }[] = []
  const addObstacle = (poly: Poly) => obstacles.push({ poly, box: aabbOf(poly) })
  p.walls.forEach((w) => {
    const fp = wallFootprint(w)
    if (fp) addObstacle(fp)
  })
  p.objects.filter((o) => o.locked).forEach((o) => addObstacle(objectFootprint(o)))

  const sorted = [...movable].sort((a, b) => b.size[0] * b.size[2] - a.size[0] * a.size[2])
  const result: LayoutResult = { placements: {}, unplaced: [] }
  const EPS = 1e-6

  for (const o of sorted) {
    if (p.space && o.elevation + o.size[1] > p.space.height + EPS) {
      result.unplaced.push(o.id)
      continue
    }
    // candidati: angolo minimo del rettangolo "gonfiato" di gap
    const xs = [bounds.minX - gap, ...obstacles.map((ob) => ob.box.maxX)]
    const zs = [bounds.minZ - gap, ...obstacles.map((ob) => ob.box.maxZ)]
    const candidates: Vec2[] = []
    for (const z of zs) for (const x of xs) candidates.push([x, z])
    candidates.sort((a, b) => a[1] - b[1] || a[0] - b[0])

    const rotations = Math.abs(o.rotation % 180) === 90 ? [90, 0] : [0, 90]
    let placed = false
    for (const [cx, cz] of candidates) {
      for (const rot of rotations) {
        const [w, d] = rot === 0 ? [o.size[0], o.size[2]] : [o.size[2], o.size[0]]
        const minX = cx + gap
        const minZ = cz + gap
        if (minX < bounds.minX - EPS || minZ < bounds.minZ - EPS) continue
        if (minX + w > bounds.maxX + EPS || minZ + d > bounds.maxZ + EPS) continue
        const inflated = rectPoly(cx, cz, w + 2 * gap, d + 2 * gap)
        if (obstacles.some((ob) => polysOverlap(inflated, ob.poly))) continue
        result.placements[o.id] = { position: [minX + w / 2, minZ + d / 2], rotation: rot }
        addObstacle(rectPoly(minX, minZ, w, d))
        placed = true
        break
      }
      if (placed) break
    }
    if (!placed) result.unplaced.push(o.id)
  }

  // ciò che non entra viene parcheggiato in colonna a destra dell'area, ben visibile
  let z = bounds.minZ
  for (const id of result.unplaced) {
    const o = p.objects.find((x) => x.id === id)!
    result.placements[id] = { position: [bounds.maxX + 0.5 + o.size[0] / 2, z + o.size[2] / 2], rotation: 0 }
    z += o.size[2] + 0.2
  }
  return result
}
