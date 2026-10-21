import { useMemo } from 'react'
import { Edges, Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Color } from 'three'
import type { SceneObject } from '../model/schema'
import type { SculptDoc } from '../model/sculpt'
import { useSculptGeometry } from './sculptGeometry'
import { buildModel, type Part, type PartColor } from '../model/furniture'
import { useProject, selectObject, selectedObjectIds } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { findCollisions } from '../geometry/collision'
import { deg2rad } from '../geometry/vec'
import { objectExtents } from '../geometry/footprint'
import { bananaGeometry } from './bananaGeometry'
import { gizmoBusy } from './Gizmo'
import { useSceneTheme } from '../theme'

const noRaycast = () => null

function resolveColor(c: PartColor, main: string, collision: string | null): string {
  const col = new Color()
  if (c === 'main') col.set(main)
  else if (c === 'dark') col.set(main).lerp(new Color('#000000'), 0.35)
  else if (c === 'light') col.set(main).lerp(new Color('#ffffff'), 0.45)
  else col.set(c.slice(0, 7))
  if (collision) col.lerp(new Color(collision), 0.65)
  return `#${col.getHexString()}`
}

function PartMesh({ part, main, colliding, selected }: { part: Part; main: string; colliding: boolean; selected: boolean }) {
  const theme = useSceneTheme()
  const color = resolveColor(part.c, main, colliding ? theme.collision : null)
  // colori con alpha (#rrggbbaa) diventano trasparenti
  const opacity = part.opacity ?? (part.c.length === 9 ? parseInt(part.c.slice(7), 16) / 255 : 1)
  return (
    <mesh position={part.p} scale={part.s} rotation={[part.rx ?? 0, part.ry ?? 0, part.rz ?? 0, 'YXZ']} castShadow={opacity > 0.5} receiveShadow raycast={noRaycast}>
      {part.shape === 'box' && <boxGeometry />}
      {part.shape === 'cyl' && <cylinderGeometry args={[0.5 * (part.taper ?? 1), 0.5, 1, part.segments ?? 32]} />}
      {part.shape === 'sphere' && <sphereGeometry args={[0.5, 32, 16]} />}
      {part.shape === 'banana' && <primitive object={bananaGeometry()} attach="geometry" dispose={null} />}
      <meshStandardMaterial
        color={color}
        vertexColors={part.shape === 'banana'}
        emissive={selected ? theme.selected : '#000000'}
        emissiveIntensity={selected ? 0.1 : 0}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.75}
      />
    </mesh>
  )
}

/**
 * Oggetto fatto con un modello 3D: la mesh (calcolata in un worker) viene adattata alle dimensioni
 * dell'oggetto, con la base appoggiata a y = 0 come le altre parti. Finché non è pronta si vede
 * un parallelepipedo semitrasparente.
 */
function SculptObjectMesh({ doc, size, colliding, selected }: { doc: SculptDoc; size: SceneObject['size']; colliding: boolean; selected: boolean }) {
  const theme = useSceneTheme()
  const g = useSculptGeometry(doc)
  if (!g) {
    return (
      <mesh position={[0, size[1] / 2, 0]} scale={size} raycast={noRaycast}>
        <boxGeometry />
        <meshStandardMaterial color={theme.edge} transparent opacity={0.15} />
      </mesh>
    )
  }
  const { min, max } = g.bounds
  const scale: [number, number, number] = [0, 1, 2].map((i) => size[i] / Math.max(max[i] - min[i], 1e-6)) as [number, number, number]
  return (
    <group scale={scale}>
      <mesh geometry={g.geometry} position={[-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial
          vertexColors
          // il colore del materiale moltiplica quelli della mesh: rosso in collisione
          color={colliding ? theme.collision : '#ffffff'}
          emissive={selected ? theme.selected : '#000000'}
          emissiveIntensity={selected ? 0.1 : 0}
          roughness={0.5}
        />
      </mesh>
    </group>
  )
}

function ObjectMesh({ o, colliding, selected, showLabel }: { o: SceneObject; colliding: boolean; selected: boolean; showLabel: boolean }) {
  const [w, h, d] = o.size
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const parts = useMemo<Part[]>(() => {
    const model = o.model ? buildModel(o.model, w, h, d) : null
    if (model) return model
    const shape = o.kind === 'cylinder' ? 'cyl' : o.kind === 'sphere' ? 'sphere' : 'box'
    return [{ shape, p: [0, h / 2, 0], s: [w, h, d], c: 'main' }]
  }, [o.model, o.kind, w, h, d])

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUi.getState()
    if (ui.tool !== 'select' || e.button !== 0) return
    // le maniglie del manipolatore hanno la precedenza sull'oggetto che sta sotto
    if (gizmoBusy()) return
    e.stopPropagation()
    const native = e.nativeEvent
    if (native.ctrlKey || native.metaKey || native.shiftKey) {
      // selezione multipla: aggiunge o toglie senza trascinare
      selectObject(o.id, { additive: true, wholeGroup: true })
      return
    }
    // se l'oggetto fa già parte della selezione si trascina tutta la selezione
    if (!selectedObjectIds().includes(o.id)) selectObject(o.id, { wholeGroup: true })
    const project = useProject.getState().project
    const ids = selectedObjectIds()
    const objs = project.objects.filter((x) => ids.includes(x.id))
    if (objs.some((x) => x.locked)) return
    // blocca subito la camera, prima che OrbitControls interpreti il gesto come rotazione
    if (controls) controls.enabled = false
    useProject.getState().checkpoint()
    ui.setDrag({ ids: objs.map((x) => x.id), starts: objs.map((x) => x.position), origin: [e.point.x, e.point.z], y: e.point.y })
  }

  const theme = useSceneTheme()
  const isPlainBox = !o.model && !o.sculpt && o.kind === 'box'
  const edgeColor = selected ? theme.selected : colliding ? theme.collision : isPlainBox ? theme.edge : null

  // il parallelepipedo ruota attorno al suo centro (ordine YXZ: inclinazioni locali, poi orientamento)
  // e si appoggia con il punto più basso alla quota
  const { centerY, height } = objectExtents(o)
  return (
    <group position={[o.position[0], o.elevation, o.position[1]]}>
      <group position={[0, centerY, 0]} rotation={[deg2rad(o.rotationX), deg2rad(o.rotation), deg2rad(o.rotationZ), 'YXZ']}>
        <group position={[0, -h / 2, 0]}>
          {o.sculpt ? (
            <SculptObjectMesh doc={o.sculpt} size={o.size} colliding={colliding} selected={selected} />
          ) : (
            parts.map((p, i) => <PartMesh key={i} part={p} main={o.color} colliding={colliding} selected={selected} />)
          )}
          {/* ingombro: riceve i click e mostra il contorno usato per le collisioni */}
          <mesh
            position={[0, h / 2, 0]}
            scale={[w, h, d]}
            onPointerDown={onPointerDown}
            onClick={(e) => useUi.getState().tool === 'select' && e.stopPropagation()}
          >
            <boxGeometry />
            <meshBasicMaterial visible={false} />
            {edgeColor && <Edges color={edgeColor} />}
          </mesh>
        </group>
      </group>
      {showLabel && (
        <Html center position={[0, height + 0.01, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
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
  const showCollisions = useUi((s) => s.showCollisions)
  const { ids } = findCollisions(project)
  const selected = new Set(selectedObjectIds(selection, project))
  return (
    <>
      {project.objects.map((o) => (
        <ObjectMesh
          key={o.id}
          o={o}
          colliding={showCollisions && ids.has(o.id)}
          selected={selected.has(o.id)}
          showLabel={view === '2d'}
        />
      ))}
    </>
  )
}
