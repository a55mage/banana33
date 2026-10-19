import { useEffect, useState } from 'react'
import { Viewport } from './scene/Viewport'
import { Toolbar } from './ui/Toolbar'
import { LeftPanel } from './ui/LeftPanel'
import { PropertiesPanel } from './ui/PropertiesPanel'
import { StatusBar } from './ui/StatusBar'
import { useProject } from './store/projectStore'
import { handleShortcut } from './ui/shortcuts'
import { ShortcutsHelp } from './ui/ShortcutsHelp'
import { useApplyTheme } from './theme'
import { useLang } from './i18n'
import { ToolBanner } from './ui/ToolBanner'
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
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])
}

export function App() {
  const ready = useRestoreAndAutosave()
  useShortcuts()
  useApplyTheme()
  const lang = useLang((s) => s.lang)
  useEffect(() => void (document.documentElement.lang = lang), [lang])
  return (
    <div className="app">
      <Toolbar />
      <LeftPanel />
      <main className="viewport">
        {ready && <Viewport />}
        <ToolBanner />
      </main>
      <PropertiesPanel />
      <StatusBar />
      <ShortcutsHelp />
    </div>
  )
}
