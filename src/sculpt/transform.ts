import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import type { SculptDoc, SculptNode, Vec3 } from '../model/sculpt'

/** Rotazione di un nodo (gradi, ordine YXZ come nel resto dell'app) */
export const nodeEuler = (r: Vec3) => new Euler(MathUtils.degToRad(r[0]), MathUtils.degToRad(r[1]), MathUtils.degToRad(r[2]), 'YXZ')

/** Trasformazione del nodo rispetto al genitore: i gruppi scalano i figli, le forme no (le dimensioni stanno in `size`) */
export function localMatrix(n: SculptNode): Matrix4 {
  const scale = n.kind === 'group' ? new Vector3(...n.size) : new Vector3(1, 1, 1)
  return new Matrix4().compose(new Vector3(...n.position), new Quaternion().setFromEuler(nodeEuler(n.rotation)), scale)
}

/** Trasformazione del genitore del nodo nel mondo (identità per i nodi alla radice) */
export function parentWorldMatrix(doc: SculptDoc, id: string): Matrix4 {
  const chain: SculptNode[] = []
  let cur = doc.nodes.find((n) => n.id === id)?.parentId ?? null
  while (cur) {
    const p = doc.nodes.find((n) => n.id === cur)
    if (!p) break
    chain.unshift(p)
    cur = p.parentId
  }
  return chain.reduce((m, p) => m.multiply(localMatrix(p)), new Matrix4())
}

export function worldMatrix(doc: SculptDoc, id: string): Matrix4 {
  const n = doc.nodes.find((x) => x.id === id)
  const parent = parentWorldMatrix(doc, id)
  return n ? parent.multiply(localMatrix(n)) : parent
}

/** Scompone una matrice in posizione, rotazione (gradi YXZ) e scala */
export function decompose(m: Matrix4): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const p = new Vector3()
  const q = new Quaternion()
  const s = new Vector3()
  m.decompose(p, q, s)
  const e = new Euler().setFromQuaternion(q, 'YXZ')
  return {
    position: [p.x, p.y, p.z],
    rotation: [MathUtils.radToDeg(e.x), MathUtils.radToDeg(e.y), MathUtils.radToDeg(e.z)],
    scale: [s.x, s.y, s.z],
  }
}
