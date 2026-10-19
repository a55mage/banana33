import { useRef } from 'react'
import { useProject } from '../store/projectStore'
import { useUi, type Tool } from '../store/uiStore'
import { downloadProject, FILE_EXT, readProjectFile } from '../persistence/file'
import { newProject } from '../model/factory'

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Seleziona', key: 'V' },
  { id: 'wall', label: 'Muro', key: 'M' },
  { id: 'door', label: 'Porta', key: 'P' },
  { id: 'window', label: 'Finestra', key: 'F' },
]

const SNAPS = [
  { v: 0, label: 'libero' },
  { v: 0.01, label: '1 cm' },
  { v: 0.05, label: '5 cm' },
  { v: 0.1, label: '10 cm' },
  { v: 0.5, label: '50 cm' },
]

export function Toolbar() {
  const name = useProject((s) => s.project.name)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const tool = useUi((s) => s.tool)
  const view = useUi((s) => s.view)
  const snap = useUi((s) => s.snap)
  const { setTool, setView, setSnap } = useUi.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    try {
      const p = await readProjectFile(file)
      useProject.getState().load(p)
    } catch (err) {
      alert(`File non valido: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <header className="toolbar">
      <div className="group">
        <strong className="brand">banana33</strong>
        <input
          className="project-name"
          value={name}
          onChange={(e) => useProject.getState().mutate((d) => void (d.name = e.target.value), { history: false })}
          aria-label="Nome progetto"
        />
      </div>

      <div className="group">
        <button onClick={() => useProject.getState().load(newProject('space'))} title="Nuovo progetto di verifica ingombri">
          + Spazio
        </button>
        <button
          onClick={() => {
            useProject.getState().load(newProject('plan'))
            setTool('wall')
          }}
          title="Nuova planimetria"
        >
          + Planimetria
        </button>
        <button onClick={() => downloadProject(useProject.getState().project)} title="Scarica il progetto come file">
          ⬇ Scarica
        </button>
        <button onClick={() => fileInput.current?.click()} title="Carica un progetto da file">
          ⬆ Carica
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={`${FILE_EXT},.json,application/json`}
          hidden
          onChange={(e) => {
            void onUpload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="group">
        <button disabled={!canUndo} onClick={() => useProject.getState().undo()} title="Annulla (Ctrl+Z)">
          ↶
        </button>
        <button disabled={!canRedo} onClick={() => useProject.getState().redo()} title="Ripeti (Ctrl+Y)">
          ↷
        </button>
      </div>

      <div className="group segmented">
        {TOOLS.map((t) => (
          <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="group">
        <label className="inline">
          Snap
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            {SNAPS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented">
          <button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>
            2D
          </button>
          <button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>
            3D
          </button>
        </div>
      </div>
    </header>
  )
}
