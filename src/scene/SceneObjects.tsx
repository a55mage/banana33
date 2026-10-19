import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { SceneObject } from '../model/schema'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { findCollisions } from '../geometry/collision'
import { deg2rad } from '../geometry/vec'

function Geometry({ kind }: { kind: SceneObject['kind'] }) {
  // geometrie unitarie scalate dalla mesh: un cilindro/sfera con larghezza ≠ profondità diventa ellittico
  if (kind === 'cylinder') return <cylinderGeometry args={[0.5, 0.5, 1, 40]} />
  if (kind === 'sphere') return <sphereGeometry args={[0.5, 40, 20]} />
  return <boxGeometry args={[1, 1, 1]} />
}

function ObjectMesh({ o, colliding, selected, showLabel }: { o: SceneObject; colliding: boolean; selected: boolean; showLabel: boolean }) {
  const [w, h, d] = o.size

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUi.getState()
    if (ui.tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    ui.setSelection({ type: 'object', id: o.id })
    if (o.locked) return
    useProject.getState().checkpoint()
    ui.setDrag({ id: o.id, offset: [o.position[0] - e.point.x, o.position[1] - e.point.z] })
  }

  return (
    <group position={[o.position[0], o.elevation, o.position[1]]} rotation={[0, deg2rad(o.rotation), 0]}>
      <mesh
        position={[0, h / 2, 0]}
        scale={[w, h, d]}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
        onClick={(e) => useUi.getState().tool === 'select' && e.stopPropagation()}
      >
        <Geometry kind={o.kind} />
        <meshStandardMaterial
          color={colliding ? '#e5484d' : o.color}
          emissive={selected ? '#2f6fed' : '#000000'}
          emissiveIntensity={selected ? 0.25 : 0}
          transparent
          opacity={colliding ? 0.85 : 1}
        />
        {o.kind === 'box' && <Edges color={selected ? '#2f6fed' : '#3a3a3a'} />}
      </mesh>
      {showLabel && (
        <Html center position={[0, h + 0.01, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className={`obj-label${colliding ? ' warn' : ''}`}>{o.name}</div>
        </Html>
      )}
    </group>
  )
}

export function SceneObjects() {
  const project = useProject((s) => s.project)
  const selection = useUi((s) => s.selection)
  const view = useUi((s) => s.view)
  const { ids } = findCollisions(project)
  return (
    <>
      {project.objects.map((o) => (
        <ObjectMesh
          key={o.id}
          o={o}
          colliding={ids.has(o.id)}
          selected={selection?.type === 'object' && selection.id === o.id}
          showLabel={view === '2d'}
        />
      ))}
    </>
  )
}
