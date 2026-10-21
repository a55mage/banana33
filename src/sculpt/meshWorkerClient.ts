import type { SculptDoc } from '../model/sculpt'
import type { SculptMesh } from './mesh'

export interface MeshJob {
  /** null se il modello è vuoto o il lavoro è stato annullato */
  promise: Promise<{ mesh: SculptMesh; issues: number } | null>
  cancel: () => void
}

/** Calcola la mesh di un modello in un Web Worker dedicato (vedi mesh.worker.ts) */
export function meshInWorker(doc: SculptDoc, resolution: number, onProgress?: (p: number) => void): MeshJob {
  const worker = new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' })
  let settle: (v: null) => void = () => {}
  const promise = new Promise<{ mesh: SculptMesh; issues: number } | null>((resolve, reject) => {
    settle = resolve
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress?.(e.data.progress)
      else if (e.data.type === 'empty') resolve(null)
      else if (e.data.type === 'done') resolve({ mesh: e.data.mesh, issues: e.data.issues })
    }
    worker.onerror = (e) => reject(new Error(e.message))
    worker.postMessage({ doc, resolution })
  }).finally(() => worker.terminate())
  return {
    promise,
    cancel: () => {
      worker.terminate()
      // un lavoro annullato si conclude senza risultato
      settle(null)
    },
  }
}
