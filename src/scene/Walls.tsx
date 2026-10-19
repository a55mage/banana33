import { Html, Line } from '@react-three/drei'
import { useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { Opening, Vec2, Wall } from '../model/schema'
import { useProject, addOpening } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { offsetOnWall, pointAlong, wallFrame, wallPieces } from '../geometry/walls'
import { dist } from '../geometry/vec'
import { OPENING_DEFAULTS } from '../model/factory'
import { formatLength, useUnit } from '../units'
import { useSceneTheme } from '../theme'

/** Altezza dei muri abbassati (vista "alla The Sims") */
const LOW_WALL = 0.25

function WallMesh({ wall, openings, selected, plan, low }: { wall: Wall; openings: Opening[]; selected: boolean; plan: boolean; low: boolean }) {
  const theme = useSceneTheme()
  const { angle } = wallFrame(wall)
  // in pianta si mostra la sezione orizzontale: niente architravi né parapetti sopra/sotto le aperture;
  // un muro abbassato è lo stesso muro con altezza ridotta (le porte restano come varchi)
  const shown = low ? { ...wall, height: Math.min(wall.height, LOW_WALL) } : wall
  const pieces = wallPieces(shown, openings).filter((p) => !plan || p.part === 'solid')

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const ui = useUi.getState()
    if (e.delta > 4) return
    if (ui.tool === 'select') {
      e.stopPropagation()
      ui.setSelection({ type: 'wall', id: wall.id })
    } else if (ui.tool === 'door' || ui.tool === 'window') {
      e.stopPropagation()
      const offset = offsetOnWall(wall, [e.point.x, e.point.z], OPENING_DEFAULTS[ui.tool].width)
      if (offset !== null) addOpening(wall.id, ui.tool, offset)
    }
    // con lo strumento muro il click passa al pavimento, così si può partire da un muro esistente
  }

  return (
    <group onClick={onClick}>
      {pieces.map((p, i) => (
        <mesh key={i} position={p.center} rotation={[0, angle, 0]} castShadow receiveShadow>
          <boxGeometry args={[p.length, p.height, wall.thickness]} />
          <meshStandardMaterial color={selected ? theme.selected : plan ? theme.wallPlan : low ? theme.wallCut : theme.wall3d} />
        </mesh>
      ))}
      {!low &&
        openings.map((op) => (
          <OpeningMesh key={op.id} wall={wall} op={op} plan={plan} />
        ))}
    </group>
  )
}

/** Arco di apertura della porta (solo in pianta), cardine all'estremo sinistro del vano */
function DoorSwing({ wall, op, color }: { wall: Wall; op: Opening; color: string }) {
  const { dir } = wallFrame(wall)
  const n: Vec2 = [-dir[1], dir[0]]
  const hinge = pointAlong(wall, op.offset - op.width / 2)
  const h = wall.thickness / 2
  const y = wall.height + 0.01
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * (Math.PI / 2)
    const c = Math.cos(t) * op.width
    const s = Math.sin(t) * op.width + h
    pts.push([hinge[0] + dir[0] * c + n[0] * s, y, hinge[1] + dir[1] * c + n[1] * s])
  }
  const leafEnd = pts[pts.length - 1]
  return (
    <>
      <Line points={pts} color={color} lineWidth={1} />
      <Line points={[[hinge[0] + n[0] * h, y, hinge[1] + n[1] * h], leafEnd]} color={color} lineWidth={2} />
    </>
  )
}

function OpeningMesh({ wall, op, plan }: { wall: Wall; op: Opening; plan: boolean }) {
  const selected = useUi((s) => s.selection?.type === 'opening' && s.selection.id === op.id)
  const theme = useSceneTheme()
  const { angle } = wallFrame(wall)
  const [x, z] = pointAlong(wall, op.offset)
  const isDoor = op.kind === 'door'
  const depth = isDoor ? wall.thickness * 0.3 : wall.thickness * 0.4
  return (
    <>
    {plan && isDoor && <DoorSwing wall={wall} op={op} color={selected ? theme.selected : theme.doorPlan} />}
    <mesh
      position={[x, op.sill + op.height / 2, z]}
      rotation={[0, angle, 0]}
      onClick={(e) => {
        if (useUi.getState().tool !== 'select' || e.delta > 4) return
        e.stopPropagation()
        useUi.getState().setSelection({ type: 'opening', id: op.id })
      }}
    >
      <boxGeometry args={[op.width, op.height, depth]} />
      <meshStandardMaterial
        color={selected ? theme.selected : isDoor ? '#a0703c' : '#8ec5e8'}
        transparent={!isDoor}
        opacity={isDoor ? 1 : 0.55}
      />
    </mesh>
    </>
  )
}

/**
 * Muri da abbassare in modalità "ritagliata": quelli tra la camera e il centro della stanza,
 * cioè quando la camera sta dal lato del muro opposto al centro (come in The Sims).
 */
function useCutawayWalls(walls: Wall[], active: boolean): Set<string> {
  const [cut, setCut] = useState<Set<string>>(new Set())
  const key = useRef('')
  const center = useMemo<Vec2>(() => {
    const xs = walls.flatMap((w) => [w.a[0], w.b[0]])
    const zs = walls.flatMap((w) => [w.a[1], w.b[1]])
    return xs.length ? [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] : [0, 0]
  }, [walls])

  useFrame(({ camera }) => {
    if (!active) {
      if (key.current !== '') {
        key.current = ''
        setCut(new Set())
      }
      return
    }
    const ids: string[] = []
    for (const w of walls) {
      const { dir } = wallFrame(w)
      const mid: Vec2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]
      // normale del muro orientata verso il centro della stanza
      let n: Vec2 = [-dir[1], dir[0]]
      if ((center[0] - mid[0]) * n[0] + (center[1] - mid[1]) * n[1] < 0) n = [-n[0], -n[1]]
      if ((camera.position.x - mid[0]) * n[0] + (camera.position.z - mid[1]) * n[1] < 0) ids.push(w.id)
    }
    const k = ids.join(',')
    // si aggiorna lo stato solo quando cambia l'insieme, non a ogni fotogramma
    if (k !== key.current) {
      key.current = k
      setCut(new Set(ids))
    }
  })
  return cut
}

export function Walls() {
  const walls = useProject((s) => s.project.walls)
  const openings = useProject((s) => s.project.openings)
  const selection = useUi((s) => s.selection)
  const plan = useUi((s) => s.view === '2d')
  const wallMode = useUi((s) => s.wallMode)
  const cut = useCutawayWalls(walls, !plan && wallMode === 'cutaway')
  return (
    <>
      {walls.map((w) => (
        <WallMesh
          key={w.id}
          plan={plan}
          low={!plan && (wallMode === 'down' || cut.has(w.id))}
          wall={w}
          openings={openings.filter((o) => o.wallId === w.id)}
          selected={selection?.type === 'wall' && selection.id === w.id}
        />
      ))}
    </>
  )
}

/** Anteprima del muro in disegno con la sua lunghezza */
export function WallDraft() {
  const draft = useUi((s) => s.wallDraft)
  const cursor = useUi((s) => s.cursor)
  const tool = useUi((s) => s.tool)
  const unit = useUnit()
  const theme = useSceneTheme()
  if (tool !== 'wall' || !cursor) return null
  const y = 0.02
  return (
    <>
      <mesh position={[cursor[0], y, cursor[1]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={theme.selected} />
      </mesh>
      {draft && (
        <>
          <Line points={[[draft[0], y, draft[1]], [cursor[0], y, cursor[1]]]} color={theme.selected} lineWidth={2} dashed dashSize={0.1} gapSize={0.05} />
          <Html position={[(draft[0] + cursor[0]) / 2, y, (draft[1] + cursor[1]) / 2]} center style={{ pointerEvents: 'none' }}>
            <div className="obj-label">{formatLength(dist(draft, cursor), unit)}</div>
          </Html>
        </>
      )}
    </>
  )
}
