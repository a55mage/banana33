import { useEffect, useState } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import type { SculptDoc } from '../model/sculpt'
import { compileSculpt, type Bounds } from '../sculpt/compile'
import { meshInWorker } from '../sculpt/meshWorkerClient'

/** Risoluzione delle mesh dei modelli negli spazi: abbastanza fine da vedersi bene, veloce da calcolare */
const SCENE_RESOLUTION = 72

export interface SculptGeometry {
  geometry: BufferGeometry
  /** ingombro del modello, da adattare alle dimensioni dell'oggetto */
  bounds: Bounds
}

/**
 * Cache delle mesh per contenuto: oggetti con lo stesso modello (anche duplicati o ricaricati)
 * condividono la stessa geometria, calcolata una volta sola in un worker.
 */
const cache = new Map<string, Promise<SculptGeometry | null>>()

function geometryFor(doc: SculptDoc): Promise<SculptGeometry | null> {
  const key = JSON.stringify(doc)
  let entry = cache.get(key)
  if (!entry) {
    const bounds = compileSculpt(doc).bounds
    entry = bounds
      ? meshInWorker(doc, SCENE_RESOLUTION).promise.then((r) => {
          if (!r) return null
          const g = new BufferGeometry()
          g.setAttribute('position', new BufferAttribute(r.mesh.positions, 3))
          g.setAttribute('normal', new BufferAttribute(r.mesh.normals, 3))
          g.setAttribute('color', new BufferAttribute(r.mesh.colors, 3))
          g.setIndex(new BufferAttribute(r.mesh.indices, 1))
          return { geometry: g, bounds }
        })
      : Promise.resolve(null)
    // un errore non deve restare in cache: al prossimo tentativo si riprova
    entry.catch(() => cache.delete(key))
    cache.set(key, entry)
  }
  return entry
}

/** Geometria del modello (null finché non è pronta, o se il modello è vuoto) */
export function useSculptGeometry(doc: SculptDoc | null): SculptGeometry | null {
  const [result, setResult] = useState<SculptGeometry | null>(null)
  useEffect(() => {
    if (!doc) return setResult(null)
    let alive = true
    geometryFor(doc).then((g) => alive && setResult(g), () => alive && setResult(null))
    return () => {
      alive = false
    }
  }, [doc])
  return result
}
