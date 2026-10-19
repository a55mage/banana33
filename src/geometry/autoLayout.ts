import type { Project, SceneObject, Vec2 } from '../model/schema'
import { aabbOf, objectExtents, objectFootprint, polysOverlap, rectPoly, wallFootprint, type AABB, type Poly } from './footprint'

export interface LayoutResult {
  placements: Record<string, { position: Vec2; rotation: number }>
  unplaced: string[]
  /** nessuna area disponibile (né spazio né muri) */
  noArea?: boolean
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

/** Variante di posizionamento di un'unità: ingombro AABB e come applicarla data la posizione */
interface UnitOption {
  w: number
  d: number
  place: (minX: number, minZ: number) => Record<string, { position: Vec2; rotation: number }>
}

/** Oggetto singolo o gruppo, che si dispone come un blocco rigido */
interface LayoutUnit {
  ids: string[]
  area: number
  /** quota massima raggiunta (per il controllo dell'altezza dello spazio) */
  top: number
  options: UnitOption[]
}

function unionBox(boxes: AABB[]): AABB {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }))
}

function objectUnit(o: SceneObject): LayoutUnit {
  // un oggetto prova l'orientamento attuale e quello ruotato di 90°
  const rotations = Math.abs(o.rotation % 180) === 90 ? [90, 0] : [0, 90]
  const options = rotations.map((rotation): UnitOption => {
    const box = aabbOf(objectFootprint({ ...o, rotation, position: [0, 0] }))
    return {
      w: box.maxX - box.minX,
      d: box.maxZ - box.minZ,
      place: (minX, minZ) => ({ [o.id]: { position: [minX - box.minX, minZ - box.minZ], rotation } }),
    }
  })
  return { ids: [o.id], area: options[0].w * options[0].d, top: o.elevation + objectExtents(o).height, options }
}

function groupUnit(members: SceneObject[]): LayoutUnit {
  // un gruppo si sposta senza ruotare, così la disposizione interna resta intatta
  const box = unionBox(members.map((m) => aabbOf(objectFootprint(m))))
  const w = box.maxX - box.minX
  const d = box.maxZ - box.minZ
  return {
    ids: members.map((m) => m.id),
    area: w * d,
    top: Math.max(...members.map((m) => m.elevation + objectExtents(m).height)),
    options: [
      {
        w,
        d,
        place: (minX, minZ) =>
          Object.fromEntries(
            members.map((m) => [m.id, { position: [m.position[0] + minX - box.minX, m.position[1] + minZ - box.minZ] as Vec2, rotation: m.rotation }]),
          ),
      },
    ],
  }
}

/**
 * Disposizione automatica "bottom-left": oggetti e gruppi non bloccati, dal più grande al più
 * piccolo, vanno nella prima posizione libera (ordinando per Z poi X); gli oggetti provano anche
 * la rotazione di 90°. Muri, oggetti bloccati e gruppi con un membro bloccato sono ostacoli;
 * `gap` è la distanza minima.
 */
export function autoLayout(p: Project, gap = 0.05): LayoutResult {
  const byGroup = new Map<string, SceneObject[]>()
  for (const o of p.objects) if (o.groupId) byGroup.set(o.groupId, [...(byGroup.get(o.groupId) ?? []), o])
  const fixed = (o: SceneObject) => o.locked || (o.groupId !== null && byGroup.get(o.groupId)!.some((m) => m.locked))

  const units: LayoutUnit[] = [
    ...p.objects.filter((o) => !o.groupId && !o.locked).map(objectUnit),
    ...[...byGroup.values()].filter((ms) => !ms.some((m) => m.locked)).map(groupUnit),
  ]
  const bounds = layoutBounds(p)
  if (!bounds) {
    return { placements: {}, unplaced: units.flatMap((u) => u.ids), noArea: true }
  }

  const obstacles: { poly: Poly; box: AABB }[] = []
  const addObstacle = (poly: Poly) => obstacles.push({ poly, box: aabbOf(poly) })
  p.walls.forEach((w) => {
    const fp = wallFootprint(w)
    if (fp) addObstacle(fp)
  })
  p.objects.filter(fixed).forEach((o) => addObstacle(objectFootprint(o)))

  const result: LayoutResult = { placements: {}, unplaced: [] }
  const unplacedUnits: LayoutUnit[] = []
  const EPS = 1e-6

  for (const unit of [...units].sort((a, b) => b.area - a.area)) {
    if (p.space && unit.top > p.space.height + EPS) {
      unplacedUnits.push(unit)
      continue
    }
    // candidati: angolo minimo del rettangolo "gonfiato" di gap
    const xs = [bounds.minX - gap, ...obstacles.map((ob) => ob.box.maxX)]
    const zs = [bounds.minZ - gap, ...obstacles.map((ob) => ob.box.maxZ)]
    const candidates: Vec2[] = []
    for (const z of zs) for (const x of xs) candidates.push([x, z])
    candidates.sort((a, b) => a[1] - b[1] || a[0] - b[0])

    let placed = false
    for (const [cx, cz] of candidates) {
      for (const opt of unit.options) {
        const minX = cx + gap
        const minZ = cz + gap
        if (minX < bounds.minX - EPS || minZ < bounds.minZ - EPS) continue
        if (minX + opt.w > bounds.maxX + EPS || minZ + opt.d > bounds.maxZ + EPS) continue
        const inflated = rectPoly(cx, cz, opt.w + 2 * gap, opt.d + 2 * gap)
        if (obstacles.some((ob) => polysOverlap(inflated, ob.poly))) continue
        Object.assign(result.placements, opt.place(minX, minZ))
        addObstacle(rectPoly(minX, minZ, opt.w, opt.d))
        placed = true
        break
      }
      if (placed) break
    }
    if (!placed) unplacedUnits.push(unit)
  }

  // ciò che non entra viene parcheggiato in colonna a destra dell'area, ben visibile
  let z = bounds.minZ
  for (const unit of unplacedUnits) {
    const opt = unit.options[0]
    Object.assign(result.placements, opt.place(bounds.maxX + 0.5, z))
    result.unplaced.push(...unit.ids)
    z += opt.d + 0.2
  }
  return result
}
