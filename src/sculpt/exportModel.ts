import type { SculptDoc } from '../model/sculpt'
import type { SculptMesh } from './mesh'
import { QUALITY, type Quality } from './mesh'
import { toGLB, toOBJ, toSTL } from './exportFormats'

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

/** Calcola la mesh nel worker e la converte nel formato scelto; null se il modello è vuoto */
export function exportModel(doc: SculptDoc, opts: ExportOptions, onProgress: (p: number) => void): ExportJob {
  const worker = new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' })
  let cancelled = false
  let settle: (v: null) => void = () => {}
  const promise = new Promise<{ mesh: SculptMesh; issues: number } | null>((resolve, reject) => {
    settle = resolve
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress(e.data.progress)
      else if (e.data.type === 'empty') resolve(null)
      else if (e.data.type === 'done') resolve({ mesh: e.data.mesh, issues: e.data.issues })
    }
    worker.onerror = (e) => reject(new Error(e.message))
    worker.postMessage({ doc, resolution: QUALITY[opts.quality] })
  })
    .finally(() => worker.terminate())
    .then(async (r) => {
      if (!r || cancelled) return null
      const scale = opts.unit === 'mm' ? 1000 : 1
      const base = opts.name.trim().replace(/[^\w-]+/g, '_') || 'modello'
      const data =
        opts.format === 'stl' ? toSTL(r.mesh, scale) : opts.format === 'obj' ? toOBJ(r.mesh, scale, opts.name) : await toGLB(r.mesh, opts.name)
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
      worker.terminate()
      // un lavoro annullato si conclude senza risultato
      settle(null)
    },
  }
}
