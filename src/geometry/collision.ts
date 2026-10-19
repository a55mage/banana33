import type { Project, SceneObject } from '../model/schema'
import { objectFootprint, polysOverlap, wallFootprint, type Poly } from './footprint'

const EPS = 1e-6

export interface CollisionReport {
  /** oggetti in collisione o fuori dallo spazio */
  ids: Set<string>
  pairs: number
  outOfBounds: number
}

function verticalOverlap(a: SceneObject, b: SceneObject) {
  return a.elevation < b.elevation + b.size[1] - EPS && b.elevation < a.elevation + a.size[1] - EPS
}

let cache: { project: Project; report: CollisionReport } | null = null

/** Verifica di ingombro: oggetto/oggetto, oggetto/muro, oggetto/limiti dello spazio */
export function findCollisions(project: Project): CollisionReport {
  if (cache?.project === project) return cache.report

  const ids = new Set<string>()
  let pairs = 0
  let outOfBounds = 0
  const objs = project.objects
  const fps = objs.map(objectFootprint)
  const walls = project.walls.flatMap((w) => {
    const fp = wallFootprint(w)
    return fp ? [{ w, fp }] : []
  })

  const { space } = project
  objs.forEach((o, i) => {
    if (space) {
      const inside =
        fps[i].every(([x, z]) => x >= -EPS && z >= -EPS && x <= space.width + EPS && z <= space.depth + EPS) &&
        o.elevation >= -EPS &&
        o.elevation + o.size[1] <= space.height + EPS
      if (!inside) {
        ids.add(o.id)
        outOfBounds++
      }
    }
    for (let j = i + 1; j < objs.length; j++) {
      if (verticalOverlap(o, objs[j]) && polysOverlap(fps[i], fps[j])) {
        ids.add(o.id)
        ids.add(objs[j].id)
        pairs++
      }
    }
    for (const { w, fp } of walls) {
      if (o.elevation < w.height - EPS && polysOverlap(fps[i], fp as Poly)) {
        ids.add(o.id)
        pairs++
      }
    }
  })

  const report = { ids, pairs, outOfBounds }
  cache = { project, report }
  return report
}
