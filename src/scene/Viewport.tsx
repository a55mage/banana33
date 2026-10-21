import { useEffect, useMemo } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { Vec2 } from '../model/schema'
import { useProject, addWall } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { layoutBounds } from '../geometry/autoLayout'
import { aabbOf, objectFootprint } from '../geometry/footprint'
import { dist, snapValue } from '../geometry/vec'
import { SceneObjects } from './SceneObjects'
import { Walls, WallDraft } from './Walls'
import { SpaceBox } from './SpaceBox'
import { Gizmo, gizmoBusy } from './Gizmo'
import { GRID, UNITS, useUnit } from '../units'
import { useSceneTheme } from '../theme'
import { SculptView } from './SculptView'
import { compileSculpt } from '../sculpt/compile'

const ENDPOINT_SNAP = 0.15

/** Area da inquadrare: lo spazio contenitore, altrimenti muri e oggetti; per i modelli 3D il loro ingombro */
function sceneExtent(view: '2d' | '3d'): { center: Vec2; size: number; targetY?: number } {
  const p = useProject.getState().project
  if (p.kind === 'model') {
    const b = p.sculpt ? compileSculpt(p.sculpt).bounds : null
    if (!b) return { center: [0, 0], size: 0.5, targetY: 0.1 }
    const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
    return { center: [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2], size: Math.max(size * 1.1, 0.15), targetY: (b.min[1] + b.max[1]) / 2 }
  }
  let b = layoutBounds(p)
  let height = p.space?.height ?? Math.max(0, ...p.walls.map((w) => w.height))
  if (!p.space) {
    for (const o of p.objects) {
      const box = aabbOf(objectFootprint(o))
      b = b
        ? { minX: Math.min(b.minX, box.minX), minZ: Math.min(b.minZ, box.minZ), maxX: Math.max(b.maxX, box.maxX), maxZ: Math.max(b.maxZ, box.maxZ) }
        : box
      height = Math.max(height, o.elevation + o.size[1])
    }
  }
  if (!b) return { center: [0, 0] as Vec2, size: 6 }
  const footprint = Math.max(b.maxX - b.minX, b.maxZ - b.minZ)
  return {
    center: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] as Vec2,
    size: Math.max(view === '3d' ? Math.max(footprint, height * 0.8) : footprint, 0.3),
  }
}

/** Camera ortografica dall'alto per il 2D, prospettica orbitabile per il 3D */
function Cameras() {
  const view = useUi((s) => s.view)
  const drag = useUi((s) => s.drag)
  const fitNonce = useUi((s) => s.fitNonce)
  const projectId = useProject((s) => s.project.id)
  const kind = useProject((s) => s.project.kind)
  const viewport = useThree((s) => s.size)
  // reinquadra solo cambiando vista o progetto, o su richiesta ("Centra vista")
  const frame = useMemo(() => {
    const { center, size, targetY = 0 } = sceneExtent(view)
    return { center, size, targetY, zoom: Math.min(viewport.width, viewport.height) / (size * 1.4) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectId, fitNonce])
  const [cx, cz] = frame.center
  const { size } = frame
  const key = `${view}-${projectId}-${fitNonce}`

  return (
    <>
      {view === '2d' ? (
        <OrthographicCamera key={`cam-${key}`} makeDefault position={[cx, 50, cz + 0.001]} zoom={frame.zoom} near={0.1} far={200} />
      ) : (
        <PerspectiveCamera
          key={`cam-${key}`}
          makeDefault
          // i modelli si guardano più di fronte; stanze e spazi dall'alto, per vedere dentro
          position={
            kind === 'model'
              ? [cx + size * 1.0, frame.targetY + size * 0.75, cz + size * 1.5]
              : [cx + size * 0.7, frame.targetY + size * 1.6, cz + size * 1.2]
          }
          fov={45}
          near={Math.min(0.1, size / 50)}
          far={300}
        />
      )}
      <OrbitControls
        key={`ctl-${key}`}
        makeDefault
        target={[cx, frame.targetY, cz]}
        enabled={!drag}
        enableRotate={view === '3d'}
        screenSpacePanning
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </>
  )
}

function snapPoint(raw: Vec2, draft: Vec2 | null, free: boolean): Vec2 {
  const { snap } = useUi.getState()
  let p: Vec2 = [snapValue(raw[0], snap), snapValue(raw[1], snap)]
  if (draft && !free) {
    p = Math.abs(p[0] - draft[0]) >= Math.abs(p[1] - draft[1]) ? [p[0], draft[1]] : [draft[0], p[1]]
  }
  for (const w of useProject.getState().project.walls) {
    for (const e of [w.a, w.b]) if (dist(e, raw) < ENDPOINT_SNAP) return [e[0], e[1]]
  }
  return p
}

/** Piano invisibile che riceve click e movimenti: disegno muri, trascinamento, deselezione */
function Ground() {
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUi.getState()
    const raw: Vec2 = [e.point.x, e.point.z]
    if (ui.drag) {
      // il raggio va intersecato col piano orizzontale alla quota del punto afferrato:
      // usare il pavimento (y = 0) in prospettiva farebbe "saltare" l'oggetto al primo movimento
      const { ids, starts, origin: grab, y } = ui.drag
      const { origin, direction } = e.ray
      if (Math.abs(direction.y) < 1e-6) return
      const t = (y - origin.y) / direction.y
      if (t < 0) return
      const hit: Vec2 = [origin.x + direction.x * t, origin.z + direction.z * t]
      // si aggancia alla griglia il primo oggetto e lo stesso spostamento vale per tutti,
      // così la disposizione relativa di un gruppo resta identica
      const first: Vec2 = [snapValue(starts[0][0] + hit[0] - grab[0], ui.snap), snapValue(starts[0][1] + hit[1] - grab[1], ui.snap)]
      const dx = first[0] - starts[0][0]
      const dz = first[1] - starts[0][1]
      useProject.getState().mutate(
        (d) => {
          ids.forEach((id, i) => {
            const o = d.objects.find((x) => x.id === id)
            if (o) o.position = [starts[i][0] + dx, starts[i][1] + dz]
          })
        },
        { history: false },
      )
    }
    ui.setCursor(ui.tool === 'wall' ? snapPoint(raw, ui.wallDraft, e.nativeEvent.shiftKey) : raw)
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const ui = useUi.getState()
    if (e.delta > 4 || gizmoBusy()) return // era un pan/orbit o un uso del manipolatore, non un click
    if (ui.tool === 'wall') {
      const p = snapPoint([e.point.x, e.point.z], ui.wallDraft, e.nativeEvent.shiftKey)
      if (!ui.wallDraft) ui.setWallDraft(p)
      else if (dist(ui.wallDraft, p) > 0.01) {
        addWall(ui.wallDraft, p)
        ui.setWallDraft(p)
      }
    } else if (ui.tool === 'select') {
      ui.setSelection(null)
    }
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={onMove}
      onClick={onClick}
      onContextMenu={() => useUi.getState().setWallDraft(null)}
      onPointerLeave={() => useUi.getState().setCursor(null)}
    >
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

export function Viewport() {
  const view = useUi((s) => s.view)
  const kind = useProject((s) => s.project.kind)
  const model = kind === 'model'
  // i modelli 3D sono piccoli: griglia più fine (non troppo, per evitare il moiré in lontananza)
  const baseGrid = GRID[UNITS[useUnit()].system]
  const grid = model ? { cell: baseGrid.cell / 2, section: baseGrid.section / 10 } : baseGrid
  const theme = useSceneTheme()

  useEffect(() => {
    const end = () => useUi.getState().setDrag(null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [])

  return (
    <Canvas shadows flat dpr={[1, 2]} gl={{ alpha: true }} onContextMenu={(e) => e.preventDefault()}>
      <Cameras />
      <ambientLight intensity={view === '2d' ? 1.2 : theme.ambient} />
      <directionalLight position={[8, 15, 6]} color={theme.sunColor} intensity={view === '2d' ? 0.6 : theme.sun} castShadow={view === '3d'} shadow-mapSize={[2048, 2048]} />
      {/* ordine dal basso: ombre (-8 mm), pavimento dello spazio (-4 mm), griglia (0).
          Piani distanziati e ombra senza depthWrite evitano lo z-fighting che fa tremare la griglia */}
      <Grid
        args={[100, 100]}
        position={[0, 0, 0]}
        cellSize={grid.cell}
        sectionSize={grid.section}
        cellColor={theme.gridCell}
        sectionColor={theme.gridSection}
        fadeDistance={view === '2d' ? 150 : model ? 6 : 45}
        fadeStrength={1.5}
        infiniteGrid
      />
      <mesh position={[0, -0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={theme.shadowOpacity} depthWrite={false} />
      </mesh>
      <Ground />
      {model ? (
        <SculptView />
      ) : (
        <>
          <SpaceBox />
          <Walls />
          <WallDraft />
          <SceneObjects />
          <Gizmo />
        </>
      )}
    </Canvas>
  )
}
