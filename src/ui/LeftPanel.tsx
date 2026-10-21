import { useEffect, useState } from 'react'
import {
  faArrowPointer,
  faCouch,
  faShapes,
  faDoorOpen,
  faTrashCan,
  faTrowelBricks,
  faWandMagicSparkles,
  faWindowMaximize,
} from '@fortawesome/free-solid-svg-icons'
import { useProject, addObject, addSculptObject, runAutoLayout } from '../store/projectStore'
import { useUi, type Tool } from '../store/uiStore'
import { BUILDING_PRESETS, FURNITURE, PRIMITIVES, type Preset } from '../model/factory'
import { formatLength, useUnit } from '../units'
import { deleteProject, listProjects, loadProject, type ProjectMeta } from '../persistence/db'
import { useT } from '../i18n'
import { NumField } from './NumField'
import { Icon, PRESET_ICONS, type IconSource } from './Icon'
import { KIND_ICONS } from './NewProjectDialog'
import { ModelLeftPanel } from './ModelPanels'

/** Dimensioni del contenitore: presente solo (e sempre) nei progetti Spazio */
function SpaceSection() {
  const t = useT()
  const space = useProject((s) => s.project.space)
  const mutate = useProject((s) => s.mutate)
  if (!space) return null
  return (
    <section>
      <h3>{t.sidebar.space}</h3>
      <div className="fields three">
        <NumField label={t.sidebar.width} value={space.width} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.width = v))} />
        <NumField label={t.sidebar.depth} value={space.depth} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.depth = v))} />
        <NumField label={t.sidebar.height} value={space.height} min={0.1} onCommit={(v) => mutate((d) => void (d.space!.height = v))} />
      </div>
    </section>
  )
}

const BUILDING_TOOLS: { id: Exclude<Tool, 'select'>; icon: IconSource; key: string }[] = [
  { id: 'wall', icon: faTrowelBricks, key: 'M' },
  { id: 'door', icon: faDoorOpen, key: 'P' },
  { id: 'window', icon: faWindowMaximize, key: 'F' },
]

/** Strumenti di disegno: un clic attiva lo strumento, un secondo clic torna a Seleziona */
function BuildingTools() {
  const t = useT()
  const tool = useUi((s) => s.tool)
  return (
    <>
      <div className="chips">
        {BUILDING_TOOLS.map((b) => (
          <button
            key={b.id}
            className={tool === b.id ? 'active' : ''}
            aria-pressed={tool === b.id}
            onClick={() => useUi.getState().setTool(tool === b.id ? 'select' : b.id)}
            title={`${t.tools[b.id]} (${b.key})`}
          >
            <Icon icon={b.icon} /> {t.tools[b.id]}
          </button>
        ))}
        {tool !== 'select' && (
          <button onClick={() => useUi.getState().setTool('select')} title={t.tools.exit}>
            <Icon icon={faArrowPointer} /> {t.tools.select}
          </button>
        )}
      </div>
      <PresetButtons presets={BUILDING_PRESETS} />
    </>
  )
}

function PresetButtons({ presets }: { presets: Preset[] }) {
  const t = useT()
  const unit = useUnit()
  return (
    <div className="chips">
      {presets.map((p) => (
        <button key={p.id} onClick={() => addObject(p)} title={[p.size[0], p.size[2], p.size[1]].map((v) => formatLength(v, unit)).join(' × ')}>
          <Icon icon={PRESET_ICONS[p.id]} /> {t.presets[p.id]}
        </button>
      ))}
    </div>
  )
}

/** I progetti "Modello 3D" salvati nel browser, da aggiungere come oggetti */
function CustomModels() {
  const t = useT()
  const [models, setModels] = useState<ProjectMeta[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void listProjects().then((all) => alive && setModels(all.filter((m) => m.kind === 'model')))
    return () => {
      alive = false
    }
  }, [])

  const add = async (m: ProjectMeta) => {
    const p = await loadProject(m.id)
    // l'oggetto prende una copia del modello: le modifiche successive al progetto non lo cambiano
    setMessage(p?.sculpt && addSculptObject(p.sculpt, p.name) ? null : t.sidebar.emptyModel)
  }

  return (
    <details className="subgroup" open>
      <summary>{t.groups.custom}</summary>
      {models && models.length === 0 && <p className="hint">{t.sidebar.noCustomModels}</p>}
      <div className="chips">
        {models?.map((m) => (
          <button key={m.id} onClick={() => void add(m)}>
            <Icon icon={KIND_ICONS.model} /> {m.name}
          </button>
        ))}
      </div>
      {message && <p className="hint warn">{message}</p>}
    </details>
  )
}

type AddTab = 'building' | 'primitives' | 'furniture'
const ADD_TABS: { id: AddTab; icon: IconSource }[] = [
  { id: 'building', icon: faTrowelBricks },
  { id: 'primitives', icon: faShapes },
  { id: 'furniture', icon: faCouch },
]

function AddSection() {
  const t = useT()
  const kind = useProject((s) => s.project.kind)
  // muri, porte, finestre e scale esistono solo nelle planimetrie
  const tabs = ADD_TABS.filter((x) => x.id !== 'building' || kind === 'plan')
  // le planimetrie partono dalla scheda Edificio, gli spazi dall'arredo
  const [tab, setTab] = useState<AddTab>(() => (useProject.getState().project.kind === 'plan' ? 'building' : 'furniture'))
  return (
    <section>
      <h3>{t.sidebar.add}</h3>
      <div className="tabs" role="tablist" aria-label={t.sidebar.add}>
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            id={`add-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls="add-tabpanel"
            className={tab === x.id ? 'active' : ''}
            onClick={() => setTab(x.id)}
          >
            <Icon icon={x.icon} /> {t.sidebar[x.id]}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id="add-tabpanel" aria-labelledby={`add-tab-${tab}`}>
        {tab === 'building' && <BuildingTools />}
        {tab === 'primitives' && <PresetButtons presets={PRIMITIVES} />}
        {tab === 'furniture' && <CustomModels />}
        {tab === 'furniture' &&
          FURNITURE.map((g) => (
            <details key={g.id} className="subgroup" open={g.id === 'living'}>
              <summary>{t.groups[g.id]}</summary>
              <PresetButtons presets={g.presets} />
            </details>
          ))}
      </div>
    </section>
  )
}

type LayoutMsg = { kind: 'all'; n: number } | { kind: 'some'; n: number; out: number } | { kind: 'noArea' }

function LayoutSection() {
  const t = useT()
  const [gap, setGap] = useState(0.05)
  // il messaggio è salvato come dati, così si traduce anche dopo un cambio lingua
  const [msg, setMsg] = useState<LayoutMsg | null>(null)
  const text =
    msg?.kind === 'noArea'
      ? t.sidebar.noArea
      : msg?.kind === 'some'
        ? t.sidebar.arrangedSome(msg.n, msg.out)
        : msg?.kind === 'all'
          ? t.sidebar.arrangedAll(msg.n)
          : null
  return (
    <section>
      <h3>{t.sidebar.layout}</h3>
      <div className="field-row">
        <NumField label={t.sidebar.minGap} value={gap} min={0} onCommit={setGap} />
        <button
          className="primary"
          title={t.sidebar.arrangeTitle}
          onClick={() => {
            const r = runAutoLayout(gap)
            const placed = Object.keys(r.placements).length - r.unplaced.length
            setMsg(r.noArea ? { kind: 'noArea' } : r.unplaced.length ? { kind: 'some', n: placed, out: r.unplaced.length } : { kind: 'all', n: placed })
          }}
        >
          <Icon icon={faWandMagicSparkles} /> {t.sidebar.arrange}
        </button>
      </div>
      <p className="hint">{t.sidebar.lockedHint}</p>
      {text && <p className="hint strong">{text}</p>}
    </section>
  )
}

function ProjectsSection() {
  const t = useT()
  const currentId = useProject((s) => s.project.id)
  const updatedAt = useProject((s) => s.project.updatedAt)
  const [items, setItems] = useState<ProjectMeta[]>([])

  useEffect(() => {
    // aggiorna l'elenco dopo l'autosalvataggio
    const timer = setTimeout(() => void listProjects().then(setItems), 800)
    return () => clearTimeout(timer)
  }, [currentId, updatedAt])

  return (
    <section>
      <h3>{t.sidebar.projects}</h3>
      <ul className="list">
        {items.map((m) => (
          <li key={m.id} className={m.id === currentId ? 'active' : ''}>
            <span className="kind-mark" title={t.newProject.kinds[m.kind].name}>
              <Icon icon={KIND_ICONS[m.kind]} />
            </span>
            <span
              className="grow"
              onClick={async () => {
                const p = await loadProject(m.id)
                if (p) useProject.getState().load(p)
              }}
            >
              {m.name}
              <small>{new Date(m.updatedAt).toLocaleString(t.locale, { dateStyle: 'short', timeStyle: 'short' })}</small>
            </span>
            {m.id !== currentId && (
              <button
                className="icon"
                title={t.sidebar.deleteProject}
                aria-label={t.sidebar.deleteProject}
                onClick={async () => {
                  if (!confirm(t.sidebar.confirmDelete(m.name))) return
                  await deleteProject(m.id)
                  setItems(await listProjects())
                }}
              >
                <Icon icon={faTrashCan} />
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
  const kind = useProject((s) => s.project.kind)
  if (kind === 'model') {
    return (
      <aside className="panel left">
        <ModelLeftPanel />
        <ProjectsSection />
      </aside>
    )
  }
  return (
    <aside className="panel left">
      <SpaceSection />
      <AddSection key={`add-${projectId}`} />
      <LayoutSection key={`layout-${projectId}`} />
      <ProjectsSection />
    </aside>
  )
}
