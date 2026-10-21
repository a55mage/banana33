import type { SculptDoc } from '../model/sculpt'
import { QUALITY, type Quality } from './mesh'
import { toGLB, toOBJ, toSTL } from './exportFormats'
import { meshInWorker } from './meshWorkerClient'

export type ExportFormat = 'stl' | 'obj' | 'glb'
export type ExportUnit = 'mm' | 'm'

export interface ExportOptions {
  format: ExportFormat
  quality: Quality
  /** unità del file per STL e OBJ (il GLB è sempre in metri) */
  unit: ExportUnit
  name: string
}

export interface ExportResult {
  blob: Blob
  filename: string
  triangles: number
  /** spigoli non chiusi: 0 = mesh perfettamente chiusa */
  issues: number
}

export interface ExportJob {
  promise: Promise<ExportResult | null>
  cancel: () => void
}

const MIME: Record<ExportFormat, string> = { stl: 'model/stl', obj: 'model/obj', glb: 'model/gltf-binary' }

/** Calcola la mesh nel worker e la converte nel formato scelto; null se il modello è vuoto o annullato */
export function exportModel(doc: SculptDoc, opts: ExportOptions, onProgress: (p: number) => void): ExportJob {
  const job = meshInWorker(doc, QUALITY[opts.quality], onProgress)
  let cancelled = false
  const promise = job.promise.then(async (r) => {
    if (!r || cancelled) return null
    const scale = opts.unit === 'mm' ? 1000 : 1
    const base = opts.name.trim().replace(/[^\w-]+/g, '_') || 'modello'
    const data = opts.format === 'stl' ? toSTL(r.mesh, scale) : opts.format === 'obj' ? toOBJ(r.mesh, scale, opts.name) : await toGLB(r.mesh, opts.name)
    return {
      blob: new Blob([data], { type: MIME[opts.format] }),
      filename: `${base}.${opts.format}`,
      triangles: r.mesh.indices.length / 3,
      issues: r.issues,
    }
  })
  return {
    promise,
    cancel: () => {
      cancelled = true
      job.cancel()
    },
  }
}
