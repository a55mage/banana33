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

// L'elenco delle scorciatoie mostrato nell'aiuto è tradotto in i18n.ts (help.groups)

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
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
