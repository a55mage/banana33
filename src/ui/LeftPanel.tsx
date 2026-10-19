import { useEffect, useState } from 'react'
import { useProject, addObject, runAutoLayout } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { PRESETS, PRIMITIVES } from '../model/factory'
import { findCollisions } from '../geometry/collision'
import { deleteProject, listProjects, loadProject, type ProjectMeta } from '../persistence/db'
import { NumField } from './NumField'

function SpaceSection() {
  const space = useProject((s) => s.project.space)
  const mutate = useProject((s) => s.mutate)
  return (
    <section>
      <h3>
        <label className="inline">
          <input
            type="checkbox"
            checked={space !== null}
            onChange={(e) => mutate((d) => void (d.space = e.target.checked ? { width: 4, depth: 3, height: 2.7 } : null))}
          />
          Spazio contenitore
        </label>
      </h3>
      {space && (
        <div className="fields">
          <NumField label="Larghezza" value={space.width} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.width = v))} />
          <NumField label="Profondità" value={space.depth} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.depth = v))} />
          <NumField label="Altezza" value={space.height} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.height = v))} />
        </div>
      )}
    </section>
  )
}

function AddSection() {
  return (
    <section>
      <h3>Aggiungi</h3>
      <div className="chips">
        {PRIMITIVES.map((p) => (
          <button key={p.label} onClick={() => addObject(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="chips">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => addObject(p)} title={`${p.size.map((v) => Math.round(v * 100)).join(' × ')} cm`}>
            {p.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function LayoutSection() {
  const [gap, setGap] = useState(0.05)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <section>
      <h3>Disposizione automatica</h3>
      <div className="fields">
        <NumField label="Distanza min." value={gap} min={0} onCommit={setGap} />
      </div>
      <button
        className="primary"
        onClick={() => {
          const r = runAutoLayout(gap)
          const placed = Object.keys(r.placements).length - r.unplaced.length
          setMsg(
            r.error ??
              (r.unplaced.length
                ? `Disposti ${placed}, non entrano ${r.unplaced.length} (spostati a destra dell'area).`
                : `Disposti tutti gli oggetti (${placed}).`),
          )
        }}
      >
        Disponi oggetti
      </button>
      <p className="hint">Gli oggetti bloccati restano fermi e fanno da ostacolo.</p>
      {msg && <p className="hint strong">{msg}</p>}
    </section>
  )
}

function ObjectsSection() {
  const project = useProject((s) => s.project)
  const selection = useUi((s) => s.selection)
  const { ids } = findCollisions(project)
  if (project.objects.length === 0) return null
  return (
    <section>
      <h3>Oggetti ({project.objects.length})</h3>
      <ul className="list">
        {project.objects.map((o) => (
          <li
            key={o.id}
            className={selection?.id === o.id ? 'active' : ''}
            onClick={() => useUi.getState().setSelection({ type: 'object', id: o.id })}
          >
            <span className="swatch" style={{ background: o.color }} />
            {o.name}
            {o.locked && <span title="Bloccato"> 🔒</span>}
            {ids.has(o.id) && <span className="badge warn">collisione</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProjectsSection() {
  const currentId = useProject((s) => s.project.id)
  const updatedAt = useProject((s) => s.project.updatedAt)
  const [items, setItems] = useState<ProjectMeta[]>([])

  useEffect(() => {
    // aggiorna l'elenco dopo l'autosalvataggio
    const t = setTimeout(() => void listProjects().then(setItems), 800)
    return () => clearTimeout(t)
  }, [currentId, updatedAt])

  return (
    <section>
      <h3>Progetti nel browser</h3>
      <ul className="list">
        {items.map((m) => (
          <li key={m.id} className={m.id === currentId ? 'active' : ''}>
            <span
              className="grow"
              onClick={async () => {
                const p = await loadProject(m.id)
                if (p) useProject.getState().load(p)
              }}
            >
              {m.name}
              <small>{new Date(m.updatedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</small>
            </span>
            {m.id !== currentId && (
              <button
                className="icon"
                title="Elimina dal browser"
                onClick={async () => {
                  if (!confirm(`Eliminare "${m.name}" dal browser?`)) return
                  await deleteProject(m.id)
                  setItems(await listProjects())
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LeftPanel() {
  const projectId = useProject((s) => s.project.id)
  return (
    <aside className="panel left">
      <SpaceSection />
      <AddSection />
      <LayoutSection key={projectId} />
      <ObjectsSection />
      <ProjectsSection />
    </aside>
  )
}
