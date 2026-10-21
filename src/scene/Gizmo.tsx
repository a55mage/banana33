import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import { Euler, MathUtils, Object3D } from 'three'
import type { Project, SceneObject, Vec2 } from '../model/schema'
import { useProject, centerOf, selectedObjectIds } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { objectExtents } from '../geometry/footprint'

type Controls = { axis: string | null; dragging: boolean }

let controlsRef: Controls | null = null
let lastUse = 0

/**
 * Vero se il puntatore è su una maniglia del manipolatore o lo si è appena usato:
 * in quel caso clic e trascinamenti sulla scena non devono selezionare o spostare altro.
 */
export function gizmoBusy() {
  return (controlsRef?.axis ?? null) !== null || controlsRef?.dragging === true || performance.now() - lastUse < 250
}

/** Registra il manipolatore attivo (anche quello delle forme dei modelli 3D) */
export function setGizmoControls(c: unknown) {
  controlsRef = (c as Controls | null) ?? null
}

/** Da chiamare al rilascio del manipolatore: il clic che segue non deve selezionare altro */
export function noteGizmoUse() {
  lastUse = performance.now()
}

const normDeg = (v: number) => ((v % 360) + 360) % 360
const round = (v: number, step = 1e-4) => Math.round(v / step) * step

interface DragStart {
  objs: SceneObject[]
  /** posizione del proxy a inizio gesto */
  pivot: [number, number, number]
  center: Vec2
}

/** Fattore di scala "dominante": il componente più lontano da 1 (per la scala uniforme) */
function dominant(s: [number, number, number]) {
  return s.reduce((a, b) => (Math.abs(Math.log(Math.abs(b) || 1e-6)) > Math.abs(Math.log(Math.abs(a) || 1e-6)) ? b : a))
}

/** Allinea il proxy alla selezione corrente: centro dell'oggetto (o dell'insieme), orientamento, scala 1 */
function syncProxy(proxy: Object3D, p: Project, ids: string[]) {
  const objs = p.objects.filter((o) => ids.includes(o.id))
  if (objs.length === 0) return
  if (objs.length === 1) {
    const o = objs[0]
    proxy.position.set(o.position[0], o.elevation + objectExtents(o).centerY, o.position[1])
    proxy.rotation.set(MathUtils.degToRad(o.rotationX), MathUtils.degToRad(o.rotation), MathUtils.degToRad(o.rotationZ), 'YXZ')
  } else {
    const [cx, cz] = centerOf(ids, p)
    const cy = objs.reduce((sum, o) => sum + o.elevation + objectExtents(o).centerY, 0) / objs.length
    proxy.position.set(cx, cy, cz)
    proxy.rotation.set(0, 0, 0)
  }
  proxy.scale.set(1, 1, 1)
  proxy.updateMatrixWorld()
}

/** Manipolatore stile Unity (sposta / ruota / scala) per l'oggetto o il gruppo selezionato */
export function Gizmo() {
  const mode = useUi((s) => s.gizmo)
  const view = useUi((s) => s.view)
  const tool = useUi((s) => s.tool)
  const snap = useUi((s) => s.snap)
  const selection = useUi((s) => s.selection)
  const project = useProject((s) => s.project)
  const proxy = useMemo(() => new Object3D(), [])
  const start = useRef<DragStart | null>(null)
  const [shift, setShift] = useState(false)

  const ids = selectedObjectIds(selection, project)
  const objs = project.objects.filter((o) => ids.includes(o.id))
  const many = objs.length > 1
  const visible = mode !== 'none' && tool === 'select' && objs.length > 0 && !objs.some((o) => o.locked)

  // Shift durante la rotazione: scatti di 15°
  useEffect(() => {
    const on = (e: KeyboardEvent) => setShift(e.shiftKey)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
    }
  }, [])

  // fuori dal gesto il proxy segue i dati (modifiche da inspector, tastiera, annulla...)
  useLayoutEffect(() => {
    if (!start.current) syncProxy(proxy, project, ids)
  })

  if (!visible) return null

  const onChange = () => {
    const s = start.current
    if (!s) return
    const changes = new Map<string, Partial<SceneObject>>()
    const [px, py, pz] = [proxy.position.x, proxy.position.y, proxy.position.z]

    if (mode === 'translate') {
      const [dx, dy, dz] = [px - s.pivot[0], py - s.pivot[1], pz - s.pivot[2]]
      for (const o of s.objs) changes.set(o.id, { position: [round(o.position[0] + dx), round(o.position[1] + dz)], elevation: round(Math.max(0, o.elevation + dy)) })
    } else if (mode === 'rotate') {
      if (!many) {
        // rotazione libera sui tre assi; il centro resta dove si trova il manipolatore
        const o = s.objs[0]
        const e = new Euler().setFromQuaternion(proxy.quaternion, 'YXZ')
        const next = { ...o, rotationX: round(normDeg(MathUtils.radToDeg(e.x)), 0.01), rotation: round(normDeg(MathUtils.radToDeg(e.y)), 0.01), rotationZ: round(normDeg(MathUtils.radToDeg(e.z)), 0.01) }
        changes.set(o.id, { rotationX: next.rotationX, rotation: next.rotation, rotationZ: next.rotationZ, elevation: round(Math.max(0, s.pivot[1] - objectExtents(next).centerY)) })
      } else {
        // più oggetti: rotazione attorno all'asse verticale passante per il centro comune
        const a = new Euler().setFromQuaternion(proxy.quaternion, 'YXZ').y
        const [cx, cz] = s.center
        for (const o of s.objs) {
          const dx = o.position[0] - cx
          const dz = o.position[1] - cz
          changes.set(o.id, {
            position: [round(cx + dx * Math.cos(a) + dz * Math.sin(a)), round(cz - dx * Math.sin(a) + dz * Math.cos(a))],
            rotation: round(normDeg(o.rotation + MathUtils.radToDeg(a)), 0.01),
          })
        }
      }
    } else if (mode === 'scale') {
      const sc: [number, number, number] = [Math.abs(proxy.scale.x), Math.abs(proxy.scale.y), Math.abs(proxy.scale.z)]
      if (!many) {
        const o = s.objs[0]
        // con le proporzioni bloccate tutte le dimensioni seguono lo stesso fattore
        const f = o.scaleLock ? [dominant(sc), dominant(sc), dominant(sc)].map(Math.abs) : sc
        const size = o.size.map((v, i) => Math.max(0.01, round(v * f[i]))) as SceneObject['size']
        changes.set(o.id, { size, elevation: round(Math.max(0, s.pivot[1] - objectExtents({ ...o, size }).centerY)) })
      } else {
        // più oggetti: scala uniforme, anche delle distanze dal centro
        const k = Math.abs(dominant(sc))
        const [cx, cz] = s.center
        for (const o of s.objs) {
          changes.set(o.id, {
            size: o.size.map((v) => Math.max(0.01, round(v * k))) as SceneObject['size'],
            position: [round(cx + (o.position[0] - cx) * k), round(cz + (o.position[1] - cz) * k)],
          })
        }
      }
    }

    useProject.getState().mutate(
      (d) => {
        for (const o of d.objects) {
          const c = changes.get(o.id)
          if (c) Object.assign(o, c)
        }
      },
      { history: false },
    )
  }

  const plan = view === '2d'
  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        ref={setGizmoControls}
        object={proxy}
        mode={mode}
        // spostamenti nel riferimento del mondo, rotazione e scala in quello dell'oggetto (come Unity in modalità Local)
        space={mode === 'translate' || many ? 'world' : 'local'}
        size={0.85}
        // in pianta e con più oggetti si ruota solo attorno all'asse verticale
        showX={!(mode === 'rotate' && (plan || many))}
        showZ={!(mode === 'rotate' && (plan || many))}
        showY={!(plan && mode !== 'rotate')}
        translationSnap={snap > 0 ? snap : null}
        rotationSnap={shift ? MathUtils.degToRad(15) : null}
        onMouseDown={() => {
          const p = useProject.getState().project
          const sel = selectedObjectIds(useUi.getState().selection, p)
          useProject.getState().checkpoint()
          start.current = {
            objs: p.objects.filter((o) => sel.includes(o.id)),
            pivot: [proxy.position.x, proxy.position.y, proxy.position.z],
            center: centerOf(sel, p),
          }
        }}
        onObjectChange={onChange}
        onMouseUp={() => {
          start.current = null
          noteGizmoUse()
          syncProxy(proxy, useProject.getState().project, selectedObjectIds())
        }}
      />
    </>
  )
}
