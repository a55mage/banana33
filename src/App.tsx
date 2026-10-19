import { useEffect, useState } from 'react'
import { Viewport } from './scene/Viewport'
import { Toolbar } from './ui/Toolbar'
import { LeftPanel } from './ui/LeftPanel'
import { PropertiesPanel } from './ui/PropertiesPanel'
import { StatusBar } from './ui/StatusBar'
import { useProject, deleteSelection, rotateSelection } from './store/projectStore'
import { useUi } from './store/uiStore'
import { lastProjectId, loadProject, saveProject } from './persistence/db'

const AUTOSAVE_MS = 500

function useRestoreAndAutosave() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = lastProjectId()
    void (id ? loadProject(id) : Promise.resolve(null))
      .then((p) => p && useProject.getState().load(p))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    let t: ReturnType<typeof setTimeout> | undefined
    const unsub = useProject.subscribe((s, prev) => {
      if (s.project === prev.project) return
      clearTimeout(t)
      t = setTimeout(() => void saveProject(useProject.getState().project), AUTOSAVE_MS)
    })
    void saveProject(useProject.getState().project)
    return () => {
      clearTimeout(t)
      unsub()
    }
  }, [ready])

  return ready
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea')) return
      const ui = useUi.getState()
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) useProject.getState().redo()
        else useProject.getState().undo()
      } else if (ctrl && k === 'y') {
        e.preventDefault()
        useProject.getState().redo()
      } else if (ctrl) {
        return
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection()
      } else if (e.key === 'Escape') {
        if (ui.wallDraft) ui.setWallDraft(null)
        else ui.setSelection(null)
      } else if (k === 'r') rotateSelection(90)
      else if (k === 'v') ui.setTool('select')
      else if (k === 'm') ui.setTool('wall')
      else if (k === 'p') ui.setTool('door')
      else if (k === 'f') ui.setTool('window')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function App() {
  const ready = useRestoreAndAutosave()
  useShortcuts()
  return (
    <div className="app">
      <Toolbar />
      <LeftPanel />
      <main className="viewport">{ready && <Viewport />}</main>
      <PropertiesPanel />
      <StatusBar />
    </div>
  )
}
