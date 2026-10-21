import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import { Euler, MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { updateNode } from '../store/sculptActions'
import { subtreeIds, type SculptDoc, type SculptNode, type Vec3 } from '../model/sculpt'
import { parentWorldMatrix, worldMatrix } from '../sculpt/transform'
import { useSceneTheme } from '../theme'
import { noteGizmoUse, setGizmoControls } from './Gizmo'

const noRaycast = () => null
const normDeg = (v: number) => ((v % 360) + 360) % 360
const round = (v: number, step = 1e-4) => Math.round(v / step) * step

/** Nodo selezionato nel modello corrente, se esiste */
function useSelectedNode(): { doc: SculptDoc; node: SculptNode } | null {
  const doc = useProject((s) => s.project.sculpt)
  const selection = useUi((s) => s.selection)
  if (!doc || selection?.type !== 'node') return null
  const node = doc.nodes.find((n) => n.id === selection.id)
  return node ? { doc, node } : null
}

/** Geometria "fantasma" di una forma, con le stesse dimensioni dell'SDF */
function GhostShape({ node, matrix, color }: { node: SculptNode; matrix: Matrix4; color: string }) {
  const [x, y, z] = node.size
  const material = <meshBasicMaterial color={color} wireframe transparent opacity={node.op === 'add' ? 0.22 : 0.45} depthTest={false} />
  let mesh
  switch (node.kind) {
    case 'box':
      mesh = (
        <mesh scale={[x, y, z]} raycast={noRaycast}>
          <boxGeometry args={[1, 1, 1, 2, 2, 2]} />
          {material}
        </mesh>
      )
      break
    case 'cylinder':
      mesh = (
        <mesh scale={[x, y, z]} raycast={noRaycast}>
          <cylinderGeometry args={[0.5, 0.5, 1, 24, 1]} />
          {material}
        </mesh>
      )
      break
    case 'cone':
      mesh = (
        <mesh scale={[x, y, z]} raycast={noRaycast}>
          <coneGeometry args={[0.5, 1, 24, 1]} />
          {material}
        </mesh>
      )
      break
    case 'torus': {
      const tube = y / 2
      const major = Math.max((x + z) / 4 - tube, 1e-4)
      mesh = (
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <torusGeometry args={[major, tube, 10, 32]} />
          {material}
        </mesh>
      )
      break
    }
    case 'capsule': {
      const r = Math.min(x, z) / 2
      mesh = (
        <mesh raycast={noRaycast}>
          <capsuleGeometry args={[r, Math.max(y - 2 * r, 0), 6, 16]} />
          {material}
        </mesh>
      )
      break
    }
    default:
      mesh = (
        <mesh scale={[x, y, z]} raycast={noRaycast}>
          <sphereGeometry args={[0.5, 20, 12]} />
          {material}
        </mesh>
      )
  }
  return (
    <group matrixAutoUpdate={false} matrix={matrix} renderOrder={10}>
      {mesh}
    </group>
  )
}

/** Contorno della selezione: la forma, o tutte le forme del gruppo selezionato */
export function SculptSelectionGhost() {
  const sel = useSelectedNode()
  const theme = useSceneTheme()
  if (!sel) return null
  const { doc, node } = sel
  const shapes = subtreeIds(doc, node.id)
    .map((id) => doc.nodes.find((n) => n.id === id)!)
    .filter((n) => n.kind !== 'group' && !n.hidden)
  return (
    <>
      {shapes.map((n) => (
        <GhostShape key={n.id} node={n} matrix={worldMatrix(doc, n.id)} color={theme.selected} />
      ))}
    </>
  )
}

interface DragStart {
  node: SculptNode
  parentInv: Matrix4
  parentQuatInv: Quaternion
}

/** Proxy nella posizione del nodo nel mondo, con la sua rotazione e scala 1 */
function syncProxy(proxy: Object3D, doc: SculptDoc, node: SculptNode) {
  const m = worldMatrix(doc, node.id)
  const p = new Vector3()
  const q = new Quaternion()
  m.decompose(p, q, new Vector3())
  proxy.position.copy(p)
  proxy.quaternion.copy(q)
  proxy.scale.set(1, 1, 1)
  proxy.updateMatrixWorld()
}

/**
 * Manipolatore (Q/W/E/R) per la forma o il gruppo selezionato. Lavora su un proxy nel mondo e
 * riporta posizione e rotazione nel sistema del gruppo genitore; la scala cambia le dimensioni
 * della forma (o il fattore di scala del gruppo).
 */
export function SculptGizmo() {
  const sel = useSelectedNode()
  const mode = useUi((s) => s.gizmo)
  const snap = useUi((s) => s.snap)
  const proxy = useMemo(() => new Object3D(), [])
  const start = useRef<DragStart | null>(null)
  const [shift, setShift] = useState(false)

  useEffect(() => {
    const on = (e: KeyboardEvent) => setShift(e.shiftKey)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
    }
  }, [])

  // fuori dal gesto il proxy segue i dati (inspector, tastiera, annulla...)
  useLayoutEffect(() => {
    if (!start.current && sel) syncProxy(proxy, sel.doc, sel.node)
  })

  if (!sel || mode === 'none' || sel.node.locked) return null
  const { node } = sel

  const onChange = () => {
    const s = start.current
    if (!s) return
    const patch: Partial<SculptNode> = {}
    if (mode === 'translate') {
      const lp = proxy.position.clone().applyMatrix4(s.parentInv)
      patch.position = [round(lp.x), round(lp.y), round(lp.z)]
    } else if (mode === 'rotate') {
      const lq = s.parentQuatInv.clone().multiply(proxy.quaternion)
      const e = new Euler().setFromQuaternion(lq, 'YXZ')
      patch.rotation = [e.x, e.y, e.z].map((r) => round(normDeg(MathUtils.radToDeg(r)), 0.01)) as Vec3
    } else if (mode === 'scale') {
      const k = [proxy.scale.x, proxy.scale.y, proxy.scale.z].map(Math.abs)
      patch.size = s.node.size.map((v, i) => Math.max(0.001, round(v * k[i]))) as Vec3
    }
    updateNode(s.node.id, patch, false)
  }

  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        ref={setGizmoControls}
        object={proxy}
        mode={mode}
        space={mode === 'translate' ? 'world' : 'local'}
        size={0.8}
        translationSnap={snap > 0 ? snap : null}
        rotationSnap={shift ? MathUtils.degToRad(15) : null}
        onMouseDown={() => {
          const doc = useProject.getState().project.sculpt
          const cur = doc?.nodes.find((n) => n.id === node.id)
          if (!doc || !cur) return
          useProject.getState().checkpoint()
          const parent = parentWorldMatrix(doc, cur.id)
          const pq = new Quaternion()
          parent.decompose(new Vector3(), pq, new Vector3())
          start.current = { node: cur, parentInv: parent.clone().invert(), parentQuatInv: pq.invert() }
        }}
        onObjectChange={onChange}
        onMouseUp={() => {
          start.current = null
          noteGizmoUse()
          const doc = useProject.getState().project.sculpt
          const cur = doc?.nodes.find((n) => n.id === node.id)
          if (doc && cur) syncProxy(proxy, doc, cur)
        }}
      />
    </>
  )
}
