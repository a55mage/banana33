/*
 * Quante forme può disegnare lo shader. Ogni nodo occupa 7 vettori di uniform
 * (matrice 4×4, dimensioni, colore, finitura); il resto dello shader ne usa una ventina.
 * Il budget dipende dalla scheda video (WebGL2 ne garantisce almeno 224, di solito sono 1024+).
 */

const VECTORS_PER_NODE = 7
const RESERVED_VECTORS = 32
const MIN_NODES = 16
const MAX_NODES = 128
/** valore prudente finché la scheda video non è nota */
const DEFAULT_NODES = 64

let gpuFragmentUniforms: number | null = null

/** Da chiamare quando il renderer è pronto, con MAX_FRAGMENT_UNIFORM_VECTORS */
export function setGpuFragmentUniforms(vectors: number) {
  gpuFragmentUniforms = vectors
}

/** Numero massimo di nodi (forme e gruppi) di un modello per questa scheda video */
export function maxSculptNodes(vectors: number | null = gpuFragmentUniforms): number {
  if (!vectors) return DEFAULT_NODES
  return Math.max(MIN_NODES, Math.min(MAX_NODES, Math.floor((vectors - RESERVED_VECTORS) / VECTORS_PER_NODE)))
}
