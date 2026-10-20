import type { Project, SceneObject, Vec2 } from '../model/schema'
import { aabbOf, objectExtents, objectFootprint, polysOverlap, rectPoly, wallFootprint, type AABB, type Poly } from './footprint'
import { pointAlong, wallFrame } from './walls'

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
  return unionBox(polys.map(aabbOf))
}

type Placement = Record<string, { position: Vec2; rotation: number }>

/** Variante di posizionamento di un'unità (un orientamento): ingombro AABB e come applicarla */
interface UnitOption {
  w: number
  d: number
  /** rotazione applicata rispetto a quella attuale (gradi) */
  turn: number
  /** direzione del retro in pianta, per i mobili che vanno appoggiati al muro */
  back: Vec2 | null
  place: (minX: number, minZ: number) => Placement
}

/** Oggetto singolo o gruppo, che si dispone come un blocco rigido */
interface LayoutUnit {
  ids: string[]
  area: number
  longSide: number
  /** quota massima raggiunta (per il controllo dell'altezza dello spazio) */
  top: number
  /** mobile che si appoggia al muro con il retro (divano, letto, armadio...) */
  wallBacked: boolean
  options: UnitOption[]
}

/** Modelli che hanno un retro da mettere contro il muro */
const WALL_BACKED = new Set([
  'sofa', 'armchair', 'bed', 'wardrobe', 'dresser', 'bookshelf', 'tvStand', 'tv', 'nightstand',
  'kitchen', 'fridge', 'washer', 'toilet', 'washbasin', 'desk', 'bench', 'stairs',
])

const TURNS = [0, 90, 180, 270]
const normDeg = (v: number) => ((v % 360) + 360) % 360

function unionBox(boxes: AABB[]): AABB {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }))
}

/** Direzione in pianta del retro (−Z locale) con la convenzione di three.js per rotation.y */
function backDir(yawDeg: number): Vec2 {
  const r = (yawDeg * Math.PI) / 180
  return [-Math.sin(r), -Math.cos(r)]
}

/** Ruota un punto attorno a un centro (stessa convenzione di rotation.y) */
function rotateAround([x, z]: Vec2, [cx, cz]: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180
  const dx = x - cx
  const dz = z - cz
  return [cx + dx * Math.cos(r) + dz * Math.sin(r), cz - dx * Math.sin(r) + dz * Math.cos(r)]
}

function objectUnit(o: SceneObject): LayoutUnit {
  // senza blocco della rotazione si provano tutti e quattro gli orientamenti a 90°
  const yaws = o.rotationLock ? [o.rotation] : TURNS
  const wallBacked = !!o.model && WALL_BACKED.has(o.model)
  const options = yaws.map((yaw): UnitOption => {
    const box = aabbOf(objectFootprint({ ...o, rotation: yaw, position: [0, 0] }))
    return {
      w: box.maxX - box.minX,
      d: box.maxZ - box.minZ,
      turn: normDeg(yaw - o.rotation),
      back: wallBacked ? backDir(yaw) : null,
      place: (minX, minZ) => ({ [o.id]: { position: [minX - box.minX, minZ - box.minZ], rotation: yaw } }),
    }
  })
  const box0 = aabbOf(objectFootprint(o))
  const w = box0.maxX - box0.minX
  const d = box0.maxZ - box0.minZ
  return { ids: [o.id], area: w * d, longSide: Math.max(w, d), top: o.elevation + objectExtents(o).height, wallBacked, options }
}

function groupUnit(members: SceneObject[]): LayoutUnit {
  // un gruppo ruota rigidamente attorno al suo centro, così la composizione interna resta intatta
  const box0 = unionBox(members.map((m) => aabbOf(objectFootprint(m))))
  const c: Vec2 = [(box0.minX + box0.maxX) / 2, (box0.minZ + box0.maxZ) / 2]
  const canTurn = !members.some((m) => m.rotationLock)
  const options = (canTurn ? TURNS : [0]).map((turn): UnitOption => {
    const turned = members.map((m) => ({ ...m, position: rotateAround(m.position, c, turn), rotation: normDeg(m.rotation + turn) }))
    const box = unionBox(turned.map((m) => aabbOf(objectFootprint(m))))
    return {
      w: box.maxX - box.minX,
      d: box.maxZ - box.minZ,
      turn,
      back: null,
      place: (minX, minZ) =>
        Object.fromEntries(
          turned.map((m) => [m.id, { position: [m.position[0] + minX - box.minX, m.position[1] + minZ - box.minZ] as Vec2, rotation: m.rotation }]),
        ),
    }
  })
  const w = box0.maxX - box0.minX
  const d = box0.maxZ - box0.minZ
  return {
    ids: members.map((m) => m.id),
    area: w * d,
    longSide: Math.max(w, d),
    top: Math.max(...members.map((m) => m.elevation + objectExtents(m).height)),
    wallBacked: false,
    options,
  }
}

interface Obstacle {
  poly: Poly
  box: AABB
  /** ostacolo rettangolare allineato agli assi: basta il test sui rettangoli */
  rect: boolean
}

/** Lunghezza di sovrapposizione di due intervalli */
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

interface Attempt {
  placements: Placement
  placed: LayoutUnit[]
  unplaced: LayoutUnit[]
  placedArea: number
  score: number
}

/**
 * Disposizione con un ordine dato: ogni unità va nella posizione libera con il punteggio migliore.
 * Il punteggio premia il contatto con pareti e altri oggetti (la stanza resta libera al centro),
 * i mobili con il retro contro il muro e, a parità, la posizione in alto a sinistra.
 */
function layoutInOrder(order: LayoutUnit[], bounds: AABB, fixedObstacles: Obstacle[], gap: number, maxHeight: number | null): Attempt {
  const EPS = 1e-6
  const tol = gap + 0.01
  const obstacles = [...fixedObstacles]
  const placements: Placement = {}
  const placed: LayoutUnit[] = []
  const unplaced: LayoutUnit[] = []
  let placedArea = 0
  let total = 0

  for (const unit of order) {
    if (maxHeight !== null && unit.top > maxHeight + EPS) {
      unplaced.push(unit)
      continue
    }
    let best: { score: number; opt: UnitOption; x: number; z: number } | null = null

    for (const opt of unit.options) {
      const { w, d } = opt
      if (w > bounds.maxX - bounds.minX + EPS || d > bounds.maxZ - bounds.minZ + EPS) continue
      // candidati: allineato ai bordi dell'area e accostato (a distanza gap) su ogni lato degli ostacoli
      const xs = new Set([bounds.minX, bounds.maxX - w])
      const zs = new Set([bounds.minZ, bounds.maxZ - d])
      for (const ob of obstacles) {
        xs.add(ob.box.maxX + gap)
        xs.add(ob.box.minX - gap - w)
        xs.add(ob.box.minX)
        xs.add(ob.box.maxX - w)
        zs.add(ob.box.maxZ + gap)
        zs.add(ob.box.minZ - gap - d)
        zs.add(ob.box.minZ)
        zs.add(ob.box.maxZ - d)
      }

      for (const z of zs) {
        if (z < bounds.minZ - EPS || z + d > bounds.maxZ + EPS) continue
        for (const x of xs) {
          if (x < bounds.minX - EPS || x + w > bounds.maxX + EPS) continue
          // ingombro gonfiato di gap: test veloce sui rettangoli, poi SAT per gli ostacoli inclinati
          const ix0 = x - gap
          const iz0 = z - gap
          const ix1 = x + w + gap
          const iz1 = z + d + gap
          let free = true
          for (const ob of obstacles) {
            if (ix1 <= ob.box.minX + EPS || ix0 >= ob.box.maxX - EPS || iz1 <= ob.box.minZ + EPS || iz0 >= ob.box.maxZ - EPS) continue
            if (ob.rect || polysOverlap(rectPoly(ix0, iz0, ix1 - ix0, iz1 - iz0), ob.poly)) {
              free = false
              break
            }
          }
          if (!free) continue

          // contatto con i bordi dell'area e con gli ostacoli vicini (lati paralleli entro la tolleranza)
          let contact = 0
          const touching: Vec2[] = []
          const side = (len: number, dir: Vec2) => {
            if (len > EPS) {
              contact += len
              touching.push(dir)
            }
          }
          if (x - bounds.minX <= tol) side(d, [-1, 0])
          if (bounds.maxX - (x + w) <= tol) side(d, [1, 0])
          if (z - bounds.minZ <= tol) side(w, [0, -1])
          if (bounds.maxZ - (z + d) <= tol) side(w, [0, 1])
          for (const ob of obstacles) {
            const b = ob.box
            if (Math.abs(x - b.maxX) <= tol) side(overlap(z, z + d, b.minZ, b.maxZ), [-1, 0])
            if (Math.abs(b.minX - (x + w)) <= tol) side(overlap(z, z + d, b.minZ, b.maxZ), [1, 0])
            if (Math.abs(z - b.maxZ) <= tol) side(overlap(x, x + w, b.minX, b.maxX), [0, -1])
            if (Math.abs(b.minZ - (z + d)) <= tol) side(overlap(x, x + w, b.minX, b.maxX), [0, 1])
          }

          let score = contact * 10
          // retro contro una parete o un ostacolo
          if (opt.back && touching.some((t) => t[0] * opt.back![0] + t[1] * opt.back![1] > 0.9)) score += 6 + Math.max(w, d)
          // a parità si preferisce non ruotare e stare in alto a sinistra
          if (opt.turn === 0) score += 0.5
          score -= ((z - bounds.minZ) + (x - bounds.minX)) * 0.3

          if (!best || score > best.score) best = { score, opt, x, z }
        }
      }
    }

    if (best) {
      Object.assign(placements, best.opt.place(best.x, best.z))
      obstacles.push({ poly: rectPoly(best.x, best.z, best.opt.w, best.opt.d), box: { minX: best.x, minZ: best.z, maxX: best.x + best.opt.w, maxZ: best.z + best.opt.d }, rect: true })
      placed.push(unit)
      placedArea += unit.area
      total += best.score
    } else unplaced.push(unit)
  }
  return { placements, placed, unplaced, placedArea, score: total }
}

/**
 * Disposizione automatica di oggetti e gruppi non bloccati. Gli oggetti senza rotazione bloccata
 * provano i quattro orientamenti a 90°, i gruppi ruotano rigidamente. Si provano più ordini di
 * inserimento e si tiene il risultato che sistema più oggetti (poi più area, poi punteggio migliore).
 * Muri, oggetti bloccati e gruppi con un membro bloccato sono ostacoli; `gap` è la distanza minima.
 */
export function autoLayout(p: Project, gap = 0.05): LayoutResult {
  const byGroup = new Map<string, SceneObject[]>()
  for (const o of p.objects) if (o.groupId) byGroup.set(o.groupId, [...(byGroup.get(o.groupId) ?? []), o])
  const fixed = (o: SceneObject) => o.locked || (o.groupId !== null && byGroup.get(o.groupId)!.some((m) => m.locked))

  const units: LayoutUnit[] = [
    ...p.objects.filter((o) => !o.groupId && !o.locked).map(objectUnit),
    ...[...byGroup.values()].filter((ms) => ms.length > 0 && !ms.some((m) => m.locked)).map(groupUnit),
  ]
  const bounds = layoutBounds(p)
  if (!bounds) {
    return { placements: {}, unplaced: units.flatMap((u) => u.ids), noArea: true }
  }

  const obstacles: Obstacle[] = []
  p.walls.forEach((w) => {
    const fp = wallFootprint(w)
    if (fp) obstacles.push({ poly: fp, box: aabbOf(fp), rect: Math.abs(w.a[0] - w.b[0]) < 1e-9 || Math.abs(w.a[1] - w.b[1]) < 1e-9 })
  })
  // davanti alle porte resta libero lo spazio di apertura (un quadrato di lato pari alla luce, su entrambi i lati)
  for (const op of p.openings) {
    const w = p.walls.find((x) => x.id === op.wallId)
    if (!w || op.kind !== 'door') continue
    const { dir } = wallFrame(w)
    const n: Vec2 = [-dir[1], dir[0]]
    const [cx, cz] = pointAlong(w, op.offset)
    const hw = op.width / 2
    const reach = op.width + w.thickness / 2
    const corner = (s: number, t: number): Vec2 => [cx + dir[0] * s + n[0] * t, cz + dir[1] * s + n[1] * t]
    const poly = [corner(-hw, -reach), corner(hw, -reach), corner(hw, reach), corner(-hw, reach)]
    obstacles.push({ poly, box: aabbOf(poly), rect: Math.abs(dir[0]) < 1e-9 || Math.abs(dir[1]) < 1e-9 })
  }
  p.objects.filter(fixed).forEach((o) => {
    const fp = objectFootprint(o)
    obstacles.push({ poly: fp, box: aabbOf(fp), rect: false })
  })

  // ordini di inserimento: i più ingombranti prima, con varianti; con molti oggetti se ne provano meno
  const byArea = (a: LayoutUnit, b: LayoutUnit) => b.area - a.area
  const orders: LayoutUnit[][] = [
    [...units].sort(byArea),
    [...units].sort((a, b) => b.longSide - a.longSide || byArea(a, b)),
    [...units].sort((a, b) => Number(b.wallBacked) - Number(a.wallBacked) || byArea(a, b)),
  ]
  if (units.length <= 30) orders.push([...units].sort((a, b) => Math.min(...b.options.map((o) => Math.min(o.w, o.d))) - Math.min(...a.options.map((o) => Math.min(o.w, o.d))) || byArea(a, b)))

  const maxHeight = p.space ? p.space.height : null
  let best: Attempt | null = null
  for (const order of orders) {
    const attempt = layoutInOrder(order, bounds, obstacles, gap, maxHeight)
    if (
      !best ||
      attempt.placed.length > best.placed.length ||
      (attempt.placed.length === best.placed.length && attempt.placedArea > best.placedArea + 1e-9) ||
      (attempt.placed.length === best.placed.length && Math.abs(attempt.placedArea - best.placedArea) <= 1e-9 && attempt.score > best.score)
    )
      best = attempt
  }

  const result: LayoutResult = { placements: { ...best!.placements }, unplaced: [] }
  // ciò che non entra viene parcheggiato in colonna a destra dell'area, ben visibile
  let z = bounds.minZ
  for (const unit of best!.unplaced) {
    const opt = unit.options[0]
    Object.assign(result.placements, opt.place(bounds.maxX + 0.5, z))
    result.unplaced.push(...unit.ids)
    z += opt.d + 0.2
  }
  return result
}
