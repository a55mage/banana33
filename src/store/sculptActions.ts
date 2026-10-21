import type { Draft } from 'immer'
import { nanoid } from 'nanoid'
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import {
  isDescendant,
  newSculptNode,
  normalizeSculpt,
  subtreeIds,
  type SculptDoc,
  type SculptMaterial,
  type SculptNode,
  type SculptShape,
  type Vec3,
} from '../model/sculpt'
import { useProject } from './projectStore'
import { useUi } from './uiStore'
import { getT } from '../i18n'

/** Documento del modello corrente (null se il progetto non è un modello 3D) */
export function currentSculpt(): SculptDoc | null {
  return useProject.getState().project.sculpt
}

/** Modifica il documento del modello e lo rimette in ordine; non fa nulla fuori dai modelli 3D */
function editSculpt(fn: (doc: Draft<SculptDoc>) => void, history = true) {
  if (!currentSculpt()) return
  useProject.getState().mutate(
    (d) => {
      if (!d.sculpt) return
      fn(d.sculpt)
      d.sculpt.nodes = normalizeSculpt(d.sculpt as SculptDoc).nodes as Draft<SculptNode>[]
    },
    { history },
  )
}

const selectNode = (id: string | null) => useUi.getState().setSelection(id ? { type: 'node', id } : null)

/** Gruppo in cui inserire una nuova forma: il gruppo selezionato o quello del nodo selezionato */
function insertionParent(doc: SculptDoc): string | null {
  const sel = useUi.getState().selection
  if (sel?.type !== 'node') return null
  const node = doc.nodes.find((n) => n.id === sel.id)
  if (!node) return null
  return node.kind === 'group' ? node.id : node.parentId
}

export function addShape(kind: SculptShape, patch: Partial<SculptNode> = {}): string | null {
  const doc = currentSculpt()
  if (!doc) return null
  const t = getT().sculpt.shapes
  const count = doc.nodes.filter((n) => n.kind === kind).length
  const node = newSculptNode(kind, { name: `${t[kind]} ${count + 1}`, parentId: insertionParent(doc), ...patch })
  editSculpt((d) => {
    d.nodes.push(node)
  })
  selectNode(node.id)
  return node.id
}

export function updateNode(id: string, patch: Partial<SculptNode>, history = true) {
  editSculpt((d) => {
    const n = d.nodes.find((x) => x.id === id)
    if (n) Object.assign(n, patch)
  }, history)
}

/** Elimina i nodi indicati con tutto il loro contenuto */
export function deleteNodes(ids: string[]) {
  const doc = currentSculpt()
  if (!doc || ids.length === 0) return
  const gone = new Set(ids.flatMap((id) => subtreeIds(doc, id)))
  editSculpt((d) => {
    d.nodes = d.nodes.filter((n) => !gone.has(n.id))
  })
  const sel = useUi.getState().selection
  if (sel?.type === 'node' && gone.has(sel.id)) selectNode(null)
}

/** Duplica i nodi (con i loro figli), spostando la copia di 5 cm su X subito dopo l'originale */
export function duplicateNodes(ids: string[]): string[] {
  const doc = currentSculpt()
  if (!doc) return []
  const roots = ids.filter((id) => !ids.some((other) => other !== id && isDescendant(doc, id, other)))
  const copies: string[] = []
  editSculpt((d) => {
    for (const rootId of roots) {
      const sub = subtreeIds(doc, rootId)
      const map = new Map(sub.map((id) => [id, nanoid()]))
      const cloned = doc.nodes
        .filter((n) => map.has(n.id))
        .map((n): SculptNode => ({
          ...n,
          id: map.get(n.id)!,
          parentId: n.id === rootId ? n.parentId : map.get(n.parentId!)!,
          position: n.id === rootId ? [n.position[0] + 0.05, n.position[1], n.position[2]] : n.position,
          name: n.id === rootId ? `${n.name} (${getT().project.copy})` : n.name,
        }))
      // la copia va subito dopo l'ultimo nodo del sottoalbero originale
      const lastIdx = Math.max(...sub.map((id) => d.nodes.findIndex((n) => n.id === id)))
      d.nodes.splice(lastIdx + 1, 0, ...(cloned as Draft<SculptNode>[]))
      copies.push(map.get(rootId)!)
    }
  })
  if (copies.length) selectNode(copies[copies.length - 1])
  return copies
}

/**
 * Sposta un nodo nell'albero: dentro `parentId` (null = radice), prima di `beforeId`
 * oppure in fondo. Un gruppo non può finire dentro sé stesso.
 */
export function moveNode(id: string, target: { parentId: string | null; beforeId?: string }) {
  const doc = currentSculpt()
  if (!doc) return
  const parent = target.parentId ? doc.nodes.find((n) => n.id === target.parentId) : null
  if (target.parentId && (!parent || parent.kind !== 'group')) return
  if (target.parentId && (target.parentId === id || isDescendant(doc, target.parentId, id))) return
  if (target.beforeId === id) return
  editSculpt((d) => {
    const sub = new Set(subtreeIds(doc, id))
    const moving = d.nodes.filter((n) => sub.has(n.id))
    const rest = d.nodes.filter((n) => !sub.has(n.id))
    moving[0].parentId = target.parentId
    const at = target.beforeId ? rest.findIndex((n) => n.id === target.beforeId) : -1
    d.nodes = at < 0 ? [...rest, ...moving] : [...rest.slice(0, at), ...moving, ...rest.slice(at)]
  })
}

/** Raggruppa nodi dello stesso livello; il gruppo prende il posto del primo */
export function groupNodes(ids: string[]): string | null {
  const doc = currentSculpt()
  if (!doc || ids.length === 0) return null
  const nodes = doc.nodes.filter((n) => ids.includes(n.id))
  const parentId = nodes[0].parentId
  if (nodes.some((n) => n.parentId !== parentId)) return null
  const count = doc.nodes.filter((n) => n.kind === 'group').length
  const group = newSculptNode('group', { name: `${getT().sculpt.shapes.group} ${count + 1}`, parentId })
  editSculpt((d) => {
    const first = d.nodes.findIndex((n) => ids.includes(n.id))
    d.nodes.splice(first, 0, group as Draft<SculptNode>)
    for (const n of d.nodes) if (ids.includes(n.id)) n.parentId = group.id
  })
  selectNode(group.id)
  return group.id
}

// ---------- trasformazioni dei gruppi ----------

const toEuler = (r: Vec3) => new Euler(MathUtils.degToRad(r[0]), MathUtils.degToRad(r[1]), MathUtils.degToRad(r[2]), 'YXZ')

function nodeMatrix(n: SculptNode): Matrix4 {
  const scale = n.kind === 'group' ? new Vector3(...n.size) : new Vector3(1, 1, 1)
  return new Matrix4().compose(new Vector3(...n.position), new Quaternion().setFromEuler(toEuler(n.rotation)), scale)
}

/**
 * Scioglie un gruppo: i figli passano al genitore del gruppo nella stessa posizione,
 * con la trasformazione del gruppo "cotta" nelle loro posizione, rotazione e dimensioni.
 */
export function ungroupNode(groupId: string) {
  const doc = currentSculpt()
  const group = doc?.nodes.find((n) => n.id === groupId)
  if (!doc || !group || group.kind !== 'group') return
  const gm = nodeMatrix(group)
  const gScale = group.size
  editSculpt((d) => {
    for (const n of d.nodes) {
      if (n.parentId !== groupId) continue
      const world = gm.clone().multiply(nodeMatrix(n as SculptNode))
      const pos = new Vector3()
      const quat = new Quaternion()
      world.decompose(pos, quat, new Vector3())
      const e = new Euler().setFromQuaternion(quat, 'YXZ')
      n.position = [pos.x, pos.y, pos.z]
      n.rotation = [MathUtils.radToDeg(e.x), MathUtils.radToDeg(e.y), MathUtils.radToDeg(e.z)]
      // la scala del gruppo si trasferisce alle dimensioni (esatta per scale uniformi)
      n.size = [n.size[0] * gScale[0], n.size[1] * gScale[1], n.size[2] * gScale[2]]
      n.parentId = group.parentId
    }
    // i figli prendono il posto del gruppo nell'ordine di combinazione
    const idx = d.nodes.findIndex((n) => n.id === groupId)
    const kids = d.nodes.filter((n) => n.parentId === group.parentId && doc.nodes.find((o) => o.id === n.id)?.parentId === groupId)
    d.nodes = d.nodes.filter((n) => n.id !== groupId && !kids.includes(n))
    d.nodes.splice(Math.min(idx, d.nodes.length), 0, ...kids)
  })
  selectNode(null)
}

// ---------- impostazioni del modello ----------

export function setSculptMaterial(material: SculptMaterial) {
  editSculpt((d) => void (d.material = material))
}

export function toggleSymmetry(axis: 'x' | 'y' | 'z') {
  editSculpt((d) => void (d.symmetry[axis] = !d.symmetry[axis]))
}
