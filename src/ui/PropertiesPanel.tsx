import { useProject, updateObject, duplicateObject, deleteSelection } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import type { Opening, SceneObject, Wall } from '../model/schema'
import { wallFrame } from '../geometry/walls'
import { NumField } from './NumField'

function ObjectProps({ o }: { o: SceneObject }) {
  const set = (patch: Partial<SceneObject>) => updateObject(o.id, patch)
  const setSize = (i: 0 | 1 | 2, v: number) => {
    const size: SceneObject['size'] = [...o.size]
    size[i] = v
    set({ size })
  }
  return (
    <>
      <label className="field wide">
        <span>Nome</span>
        <input value={o.name} onChange={(e) => updateObject(o.id, { name: e.target.value }, false)} />
      </label>
      <div className="fields">
        <label className="field">
          <span>Colore</span>
          <input type="color" value={o.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
        <label className="field">
          <span>Forma</span>
          <select value={o.kind} onChange={(e) => set({ kind: e.target.value as SceneObject['kind'] })}>
            <option value="box">Parallelepipedo</option>
            <option value="cylinder">Cilindro</option>
            <option value="sphere">Sfera</option>
          </select>
        </label>
      </div>
      <h4>Dimensioni</h4>
      <div className="fields">
        <NumField label="Larghezza" value={o.size[0]} min={0.01} onCommit={(v) => setSize(0, v)} />
        <NumField label="Profondità" value={o.size[2]} min={0.01} onCommit={(v) => setSize(2, v)} />
        <NumField label="Altezza" value={o.size[1]} min={0.01} onCommit={(v) => setSize(1, v)} />
      </div>
      <h4>Posizione</h4>
      <div className="fields">
        <NumField label="X" value={o.position[0]} onCommit={(v) => set({ position: [v, o.position[1]] })} />
        <NumField label="Y (pianta)" value={o.position[1]} onCommit={(v) => set({ position: [o.position[0], v] })} />
        <NumField label="Quota" value={o.elevation} min={0} onCommit={(v) => set({ elevation: v })} />
        <NumField label="Rotazione" value={o.rotation} factor={1} unit="°" onCommit={(v) => set({ rotation: ((v % 360) + 360) % 360 })} />
      </div>
      <label className="inline">
        <input type="checkbox" checked={o.locked} onChange={(e) => set({ locked: e.target.checked })} />
        Bloccato (non si sposta)
      </label>
      <div className="actions">
        <button onClick={() => set({ rotation: (o.rotation + 90) % 360 })}>Ruota 90° (R)</button>
        <button onClick={() => duplicateObject(o.id)}>Duplica</button>
        <button className="danger" onClick={deleteSelection}>
          Elimina
        </button>
      </div>
    </>
  )
}

function WallProps({ w }: { w: Wall }) {
  const mutate = useProject((s) => s.mutate)
  const edit = (fn: (x: Wall) => void) =>
    mutate((d) => {
      const x = d.walls.find((y) => y.id === w.id)
      if (x) fn(x)
    })
  const { length, dir } = wallFrame(w)
  return (
    <>
      <div className="fields">
        <NumField
          label="Lunghezza"
          value={length}
          min={0.05}
          onCommit={(v) => edit((x) => void (x.b = [x.a[0] + dir[0] * v, x.a[1] + dir[1] * v]))}
        />
        <NumField label="Spessore" value={w.thickness} min={0.01} onCommit={(v) => edit((x) => void (x.thickness = v))} />
        <NumField label="Altezza" value={w.height} min={0.1} onCommit={(v) => edit((x) => void (x.height = v))} />
      </div>
      <div className="actions">
        <button className="danger" onClick={deleteSelection}>
          Elimina muro
        </button>
      </div>
    </>
  )
}

function OpeningProps({ op }: { op: Opening }) {
  const mutate = useProject((s) => s.mutate)
  const edit = (patch: Partial<Opening>) =>
    mutate((d) => {
      const x = d.openings.find((y) => y.id === op.id)
      if (x) Object.assign(x, patch)
    })
  return (
    <>
      <div className="fields">
        <label className="field">
          <span>Tipo</span>
          <select value={op.kind} onChange={(e) => edit({ kind: e.target.value as Opening['kind'] })}>
            <option value="door">Porta</option>
            <option value="window">Finestra</option>
          </select>
        </label>
        <NumField label="Larghezza" value={op.width} min={0.1} onCommit={(v) => edit({ width: v })} />
        <NumField label="Altezza" value={op.height} min={0.1} onCommit={(v) => edit({ height: v })} />
        <NumField label="Davanzale" value={op.sill} min={0} onCommit={(v) => edit({ sill: v })} />
        <NumField label="Distanza" value={op.offset} min={0} onCommit={(v) => edit({ offset: v })} />
      </div>
      <p className="hint">Distanza del centro dall'inizio del muro.</p>
      <div className="actions">
        <button className="danger" onClick={deleteSelection}>
          Elimina
        </button>
      </div>
    </>
  )
}

const TOOL_HINTS: Record<string, string> = {
  select: 'Clicca un elemento per selezionarlo, trascina gli oggetti per spostarli. Rotella per zoom, tasto destro per spostare la vista.',
  wall: 'Clicca per iniziare, clicca ancora per ogni angolo. Esc o tasto destro per terminare. Shift: angolo libero.',
  door: 'Clicca su un muro per inserire una porta.',
  window: 'Clicca su un muro per inserire una finestra.',
}

export function PropertiesPanel() {
  const selection = useUi((s) => s.selection)
  const tool = useUi((s) => s.tool)
  const project = useProject((s) => s.project)

  let body: React.ReactNode = <p className="hint">{TOOL_HINTS[tool]}</p>
  let title = 'Proprietà'
  if (selection?.type === 'object') {
    const o = project.objects.find((x) => x.id === selection.id)
    if (o) {
      title = 'Oggetto'
      body = <ObjectProps key={o.id} o={o} />
    }
  } else if (selection?.type === 'wall') {
    const w = project.walls.find((x) => x.id === selection.id)
    if (w) {
      title = 'Muro'
      body = <WallProps key={w.id} w={w} />
    }
  } else if (selection?.type === 'opening') {
    const op = project.openings.find((x) => x.id === selection.id)
    if (op) {
      title = op.kind === 'door' ? 'Porta' : 'Finestra'
      body = <OpeningProps key={op.id} op={op} />
    }
  }

  return (
    <aside className="panel right">
      <section>
        <h3>{title}</h3>
        {body}
      </section>
    </aside>
  )
}
