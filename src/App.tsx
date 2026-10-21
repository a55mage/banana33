import { useEffect, useState } from 'react'
import { Viewport } from './scene/Viewport'
import { Toolbar } from './ui/Toolbar'
import { LeftPanel } from './ui/LeftPanel'
import { PropertiesPanel } from './ui/PropertiesPanel'
import { StatusBar } from './ui/StatusBar'
import { useProject } from './store/projectStore'
import { useUi } from './store/uiStore'
import { handleShortcut } from './ui/shortcuts'
import { ShortcutsHelp } from './ui/ShortcutsHelp'
import { NewProjectDialog } from './ui/NewProjectDialog'
import { ExportDialog } from './ui/ExportDialog'
import { useApplyTheme } from './theme'
import { useLang } from './i18n'
import { ToolBanner } from './ui/ToolBanner'
import { lastProjectId, loadProject, saveProject } from './persistence/db'
import { sampleProject } from './model/factory'

const AUTOSAVE_MS = 500

function useRestoreAndAutosave() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = lastProjectId()
    void (id ? loadProject(id) : Promise.resolve(null))
      .then((p) => useProject.getState().load(p ?? sampleProject()))
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

/** Messaggio al posto della vista quando la scheda video non riesce a disegnare */
function RenderError() {
  const error = useUi((s) => s.renderError)
  if (!error) return null
  return (
    <div className="render-error" role="alert">
      {error}
    </div>
  )
}

export function App() {
  const kind = useProject((s) => s.project.kind)
  const ready = useRestoreAndAutosave()
  useShortcuts()
  useApplyTheme()
  const lang = useLang((s) => s.lang)
  useEffect(() => void (document.documentElement.lang = lang), [lang])
  return (
    <div className={`app kind-${kind}`}>
      <Toolbar />
      <LeftPanel />
      <main className="viewport">
        {ready && <Viewport />}
        <ToolBanner />
        <RenderError />
      </main>
      <PropertiesPanel />
      <StatusBar />
      <ShortcutsHelp />
      <NewProjectDialog />
      <ExportDialog />
    </div>
  )
}
