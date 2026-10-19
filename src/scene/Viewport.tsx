import { useEffect, useMemo } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { Vec2 } from '../model/schema'
import { useProject, addWall } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { layoutBounds } from '../geometry/autoLayout'
import { dist, snapValue } from '../geometry/vec'
import { SceneObjects } from './SceneObjects'
import { Walls, WallDraft } from './Walls'
import { SpaceBox } from './SpaceBox'

const ENDPOINT_SNAP = 0.15

function sceneExtent() {
  const b = layoutBounds(useProject.getState().project)
  if (!b) return { center: [0, 0] as Vec2, size: 6 }
  return {
    center: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] as Vec2,
    size: Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 2),
  }
}

/** Camera ortografica dall'alto per il 2D, prospettica orbitabile per il 3D */
function Cameras() {
  const view = useUi((s) => s.view)
  const drag = useUi((s) => s.drag)
  const projectId = useProject((s) => s.project.id)
  const { size: viewport } = useThree((s) => s)
  // ricalcola l'inquadratura solo cambiando vista o progetto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { center, size } = useMemo(sceneExtent, [view, projectId])
  const [cx, cz] = center
  const zoom = Math.min(viewport.width, viewport.height) / (size * 1.4)

  return (
    <>
      {view === '2d' ? (
        <OrthographicCamera key={`o-${projectId}`} makeDefault position={[cx, 50, cz + 0.001]} zoom={zoom} near={0.1} far={500} />
      ) : (
        <PerspectiveCamera key={`p-${projectId}`} makeDefault position={[cx + size * 0.9, size * 1.4, cz + size * 1.7]} fov={45} near={0.05} far={500} />
      )}
      <OrbitControls
        key={`${view}-${projectId}`}
        makeDefault
        target={[cx, 0, cz]}
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
      const { id, offset } = ui.drag
      const pos: Vec2 = [snapValue(raw[0] + offset[0], ui.snap), snapValue(raw[1] + offset[1], ui.snap)]
      useProject.getState().mutate(
        (d) => {
          const o = d.objects.find((x) => x.id === id)
          if (o) o.position = pos
        },
        { history: false },
      )
    }
    ui.setCursor(ui.tool === 'wall' ? snapPoint(raw, ui.wallDraft, e.nativeEvent.shiftKey) : raw)
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const ui = useUi.getState()
    if (e.delta > 4) return // era un pan/orbit, non un click
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

  useEffect(() => {
    const end = () => useUi.getState().setDrag(null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [])

  return (
    <Canvas shadows dpr={[1, 2]} onContextMenu={(e) => e.preventDefault()}>
      <color attach="background" args={['#f3f2ee']} />
      <Cameras />
      <ambientLight intensity={view === '2d' ? 1.2 : 0.7} />
      <directionalLight position={[8, 15, 6]} intensity={view === '2d' ? 0.6 : 1.2} castShadow={view === '3d'} shadow-mapSize={[2048, 2048]} />
      <Grid
        args={[100, 100]}
        position={[0, -0.001, 0]}
        cellSize={0.1}
        sectionSize={1}
        cellColor="#d6d3cb"
        sectionColor="#b0aca1"
        fadeDistance={view === '2d' ? 400 : 60}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <Ground />
      <SpaceBox />
      <Walls />
      <WallDraft />
      <SceneObjects />
    </Canvas>
  )
}
