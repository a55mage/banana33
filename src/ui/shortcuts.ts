import {
  useProject,
  deleteSelection,
  duplicateSelection,
  moveSelection,
  rotateSelection,
  scaleSelection,
  groupSelection,
  ungroupSelection,
  selectAllObjects,
  selectedObjectIds,
} from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { deleteNodes, duplicateNodes, groupNodes, ungroupNode, updateNode } from '../store/sculptActions'
import type { SculptOp } from '../model/sculpt'

// L'elenco delle scorciatoie mostrato nell'aiuto è tradotto in i18n.ts (help.groups)

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** Scorciatoie della modalità Modello 3D sulla forma selezionata; restituisce true se il tasto è stato gestito */
function handleModelShortcut(e: KeyboardEvent, k: string, ctrl: boolean, run: (fn: () => void) => void): boolean {
  const sel = useUi.getState().selection
  const doc = useProject.getState().project.sculpt
  const node = sel?.type === 'node' ? doc?.nodes.find((n) => n.id === sel.id) : undefined
  if (ctrl) {
    if (k === 'd' && node) run(() => duplicateNodes([node.id]))
    else if (k === 'g' && node) run(() => (e.shiftKey ? node.kind === 'group' && ungroupNode(node.id) : groupNodes([node.id])))
    else if (k === 'a') e.preventDefault()
    else return false
    return true
  }
  if (!node || e.altKey) return false
  const step = (useUi.getState().snap || 0.01) * (e.shiftKey ? 10 : 1)
  const nudge = (dx: number, dy: number, dz: number) => {
    if (node.locked) return
    updateNode(node.id, { position: [node.position[0] + dx, node.position[1] + dy, node.position[2] + dz] })
  }
  if (e.key in ARROWS) {
    const [dx, dz] = ARROWS[e.key]
    run(() => nudge(dx * step, 0, dz * step))
    return true
  }
  switch (e.key) {
    case 'PageUp':
      run(() => nudge(0, step, 0))
      return true
    case 'PageDown':
      run(() => nudge(0, -step, 0))
      return true
    case 'Delete':
    case 'Backspace':
      run(() => deleteNodes([node.id]))
      return true
  }
  const ops: Record<string, SculptOp> = { a: 'add', s: 'subtract', i: 'intersect' }
  if (k in ops) {
    run(() => updateNode(node.id, { op: ops[k] }))
    return true
  }
  if (k === 'h') {
    run(() => updateNode(node.id, { hidden: !node.hidden }))
    return true
  }
  return false
}

export function handleShortcut(e: KeyboardEvent) {
  if (e.target instanceof Element && e.target.closest('input, select, textarea')) return
  const ui = useUi.getState()
  const ctrl = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()

  const run = (fn: () => void) => {
    e.preventDefault()
    fn()
  }

  if (useProject.getState().project.kind === 'model' && handleModelShortcut(e, k, ctrl, run)) return

  if (ctrl) {
    if (k === 'z') run(() => (e.shiftKey ? useProject.getState().redo() : useProject.getState().undo()))
    else if (k === 'y') run(() => useProject.getState().redo())
    else if (k === 'd') run(duplicateSelection)
    else if (k === 'g') run(() => (e.shiftKey ? ungroupSelection() : groupSelection()))
    else if (k === 'a') run(selectAllObjects)
    return
  }
  if (e.altKey) return

  if (e.key in ARROWS) {
    if (selectedObjectIds().length === 0) return
    const step = (ui.snap || 0.01) * (e.shiftKey ? 10 : 1)
    const [dx, dz] = ARROWS[e.key]
    return run(() => moveSelection(dx * step, dz * step))
  }

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      return run(deleteSelection)
    case 'Escape':
      if (ui.showHelp) return ui.setShowHelp(false)
      if (ui.wallDraft) return ui.setWallDraft(null)
      if (ui.tool !== 'select') return ui.setTool('select')
      return ui.setSelection(null)
    case '?':
      return ui.setShowHelp(!ui.showHelp)
    case '+':
    case '=':
      return run(() => scaleSelection(1.1))
    case '-':
    case '_':
      return run(() => scaleSelection(1 / 1.1))
  }

  // rotazioni rapide: [ ] di 15°, con Shift di 90° (e.code non dipende dal layout di tastiera)
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
    const sign = e.code === 'BracketLeft' ? -1 : 1
    return run(() => rotateSelection(sign * (e.shiftKey ? 90 : 15)))
  }

  switch (k) {
    case 'q':
      return ui.setGizmo('none')
    case 'w':
      return ui.setGizmo('translate')
    case 'e':
      return ui.setGizmo('rotate')
    case 'r':
      return ui.setGizmo('scale')
    case 'c':
      return ui.requestFit()
    case 'k':
      return ui.toggleCollisions()
    case 'h':
      return ui.cycleWallMode()
    case '2':
      return useProject.getState().project.kind === 'model' ? undefined : ui.setView('2d')
    case '3':
      return ui.setView('3d')
    case 'v':
      return ui.setTool('select')
    case 'm':
      return useProject.getState().project.kind === 'plan' ? ui.setTool('wall') : undefined
    case 'p':
      return useProject.getState().project.kind === 'plan' ? ui.setTool('door') : undefined
    case 'f':
      return useProject.getState().project.kind === 'plan' ? ui.setTool('window') : undefined
  }
}
