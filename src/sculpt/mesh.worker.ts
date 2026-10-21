/// <reference lib="webworker" />
import { compileSculpt } from './compile'
import { meshSculpt, nonManifoldEdges } from './mesh'
import { SculptDocSchema } from '../model/sculpt'

/*
 * Calcolo della mesh in un Web Worker, per non bloccare l'interfaccia.
 * Riceve { doc, resolution } e invia { type: 'progress' } durante il lavoro,
 * poi { type: 'done', mesh, issues } (con i buffer trasferiti) oppure { type: 'empty' }.
 */
self.onmessage = (e: MessageEvent<{ doc: unknown; resolution: number }>) => {
  const compiled = compileSculpt(SculptDocSchema.parse(e.data.doc))
  let last = 0
  const mesh = meshSculpt(compiled, e.data.resolution, (p) => {
    // al massimo un messaggio ogni punto percentuale
    if (p - last >= 0.01 || p === 1) {
      last = p
      self.postMessage({ type: 'progress', progress: p })
    }
  })
  if (!mesh) {
    self.postMessage({ type: 'empty' })
    return
  }
  const issues = nonManifoldEdges(mesh)
  self.postMessage({ type: 'done', mesh, issues }, [mesh.positions.buffer, mesh.normals.buffer, mesh.colors.buffer, mesh.indices.buffer])
}
