import { useState, type DragEvent } from 'react'
import {
  faCapsules,
  faCaretUp,
  faCircle,
  faClone,
  faCube,
  faDatabase,
  faEye,
  faEyeSlash,
  faFolderPlus,
  faGripVertical,
  faLayerGroup,
  faLock,
  faLockOpen,
  faMinus,
  faObjectUngroup,
  faPlus,
  faRing,
  faTrashCan,
  faCropSimple,
} from '@fortawesome/free-solid-svg-icons'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import {
  addShape,
  deleteNodes,
  duplicateNodes,
  groupNodes,
  moveNode,
  pickNode,
  setSculptMaterial,
  toggleSymmetry,
  ungroupNode,
  updateNode,
  updateNodes,
} from '../store/sculptActions'
import { childrenOf, type SculptDoc, type SculptMaterial, type SculptNode, type SculptOp, type SculptShape, type Vec3 } from '../model/sculpt'
import { useT } from '../i18n'
import { formatLength, useUnit } from '../units'
import { Icon, type IconSource } from './Icon'
import { NumField } from './NumField'

export const SHAPE_ICONS: Record<SculptShape | 'group', IconSource> = {
  sphere: faCircle,
  box: faCube,
  cylinder: faDatabase,
  cone: faCaretUp,
  torus: faRing,
  capsule: faCapsules,
  group: faLayerGroup,
}
export const OP_ICONS: Record<SculptOp, IconSource> = { add: faPlus, subtract: faMinus, intersect: faCropSimple }
const SHAPES: SculptShape[] = ['sphere', 'box', 'cylinder', 'cone', 'torus', 'capsule']
const MATERIALS: SculptMaterial[] = ['matte', 'glossy', 'metal', 'clay']
const MIME = 'application/x-banana33-node'

function PaletteSection() {
  const t = useT()
  return (
    <section>
      <h3>{t.sculpt.addShape}</h3>
      <div className="shape-palette">
        {SHAPES.map((k) => (
          <button key={k} onClick={() => addShape(k)} title={t.sculpt.shapes[k]}>
            <Icon icon={SHAPE_ICONS[k]} />
            <span>{t.sculpt.shapes[k]}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

type Drop = { kind: 'before' | 'into'; id: string } | { kind: 'end' } | null

/** Albero dei livelli: l'ordine conta, ogni livello si combina con quelli che lo precedono */
function LayersSection({ doc }: { doc: SculptDoc }) {
  const t = useT()
  const selection = useUi((s) => s.selection)
  const selectedIds = selection?.type === 'node' ? [selection.id] : selection?.type === 'nodes' ? selection.ids : []
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const [drop, setDrop] = useState<Drop>(null)

  const over = (target: Exclude<Drop, null>) => (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(MIME)) return
    e.preventDefault()
    e.stopPropagation()
    setDrop(target)
  }
  const onDrop = (target: Exclude<Drop, null>) => (e: DragEvent) => {
    const id = e.dataTransfer.getData(MIME)
    setDrop(null)
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    if (target.kind === 'into') moveNode(id, { parentId: target.id })
    else if (target.kind === 'end') moveNode(id, { parentId: null })
    else {
      const before = doc.nodes.find((n) => n.id === target.id)
      moveNode(id, { parentId: before?.parentId ?? null, beforeId: target.id })
    }
  }

  const row = (n: SculptNode, depth: number): React.ReactNode => {
    const isGroup = n.kind === 'group'
    const cls = ['layer', selectedIds.includes(n.id) && 'active', n.hidden && 'hidden', drop && 'id' in drop && drop.id === n.id && `drop-${drop.kind}`]
    return (
      <li key={n.id}>
        <div
          className={cls.filter(Boolean).join(' ')}
          style={{ paddingLeft: 6 + depth * 14 }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(MIME, n.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => setDrop(null)}
          onDragOver={over({ kind: isGroup ? 'into' : 'before', id: n.id })}
          onDrop={onDrop({ kind: isGroup ? 'into' : 'before', id: n.id })}
          onClick={(e) => pickNode(n.id, e.ctrlKey || e.metaKey || e.shiftKey)}
        >
          <span className="grip" aria-hidden="true">
            <Icon icon={faGripVertical} />
          </span>
          <span className={`op-badge op-${n.op}`} title={t.sculpt.ops[n.op]}>
            <Icon icon={OP_ICONS[n.op]} />
          </span>
          <span className="shape-icon" style={isGroup ? undefined : { color: n.color }}>
            <Icon icon={SHAPE_ICONS[n.kind]} />
          </span>
          <span className="grow">{n.name}</span>
          <button
            className="icon"
            title={n.hidden ? t.sculpt.show : t.sculpt.hide}
            aria-label={n.hidden ? t.sculpt.show : t.sculpt.hide}
            onClick={(e) => {
              e.stopPropagation()
              updateNode(n.id, { hidden: !n.hidden })
            }}
          >
            <Icon icon={n.hidden ? faEyeSlash : faEye} />
          </button>
          <button
            className="icon"
            title={n.locked ? t.sculpt.unlock : t.sculpt.lock}
            aria-label={n.locked ? t.sculpt.unlock : t.sculpt.lock}
            onClick={(e) => {
              e.stopPropagation()
              updateNode(n.id, { locked: !n.locked })
            }}
          >
            <Icon icon={n.locked ? faLock : faLockOpen} />
          </button>
        </div>
        {isGroup && <ul className="layers">{childrenOf(doc, n.id).map((c) => row(c, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <section>
      <div className="heading-row">
        <h3>{t.sculpt.layers}</h3>
        <button className="icon-btn small" disabled={!selectedId} onClick={() => selectedId && groupNodes([selectedId])} title={t.sculpt.newGroup} aria-label={t.sculpt.newGroup}>
          <Icon icon={faFolderPlus} />
        </button>
      </div>
      {doc.nodes.length === 0 ? (
        <p className="hint">{t.sculpt.emptyLayers}</p>
      ) : (
        <ul className="layers" onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
          {childrenOf(doc, null).map((n) => row(n, 0))}
          <li className={`layer-end${drop?.kind === 'end' ? ' active-drop' : ''}`} onDragOver={over({ kind: 'end' })} onDrop={onDrop({ kind: 'end' })} />
        </ul>
      )}
      <p className="hint">{t.sculpt.layersHint}</p>
    </section>
  )
}

function SettingsSection({ doc }: { doc: SculptDoc }) {
  const t = useT()
  const showCutters = useUi((s) => s.showCutters)
  return (
    <section>
      <h3>{t.sculpt.settings}</h3>
      <span className="field-label">{t.sculpt.material}</span>
      <div className="segmented wide">
        {MATERIALS.map((m) => (
          <button key={m} className={doc.material === m ? 'active' : ''} aria-pressed={doc.material === m} onClick={() => setSculptMaterial(m)}>
            {t.sculpt.materials[m]}
          </button>
        ))}
      </div>
      <span className="field-label">{t.sculpt.symmetry}</span>
      <div className="segmented wide">
        {(['x', 'y', 'z'] as const).map((a) => (
          <button key={a} className={doc.symmetry[a] ? 'active' : ''} aria-pressed={doc.symmetry[a]} onClick={() => toggleSymmetry(a)} title={t.sculpt.symmetryHint}>
            {a.toUpperCase()}
          </button>
        ))}
      </div>
      <label className="inline">
        <input type="checkbox" checked={showCutters} onChange={(e) => useUi.getState().setShowCutters(e.target.checked)} />
        {t.sculpt.showCutters}
      </label>
    </section>
  )
}

export function ModelLeftPanel() {
  const doc = useProject((s) => s.project.sculpt)
  if (!doc) return null
  return (
    <>
      <PaletteSection />
      <LayersSection doc={doc} />
      <SettingsSection doc={doc} />
    </>
  )
}

// ---------------------------------------------------------------- inspector

/** Cursore con valore numerico nell'unità del progetto */
function SliderField({ label, value, max, onChange, disabled }: { label: string; value: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  const unit = useUnit()
  return (
    <label className={`field slider${disabled ? ' disabled' : ''}`}>
      <span>
        {label} <em>{formatLength(value, unit)}</em>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={max / 200}
        value={Math.min(value, max)}
        disabled={disabled}
        // un solo passo di annulla per gesto: si salva lo stato all'inizio, poi si aggiorna senza cronologia
        onPointerDown={() => useProject.getState().checkpoint()}
        onKeyDown={() => useProject.getState().checkpoint()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

const normDeg = (v: number) => ((v % 360) + 360) % 360

/** Finitura della forma: quella del modello o una propria */
function FinishPicker({ value, onChange }: { value: SculptMaterial | null; onChange: (m: SculptMaterial | null) => void }) {
  const t = useT()
  return (
    <>
      <span className="field-label">{t.sculpt.finish}</span>
      <div className="segmented wide finish">
        <button className={value === null ? 'active' : ''} aria-pressed={value === null} onClick={() => onChange(null)}>
          {t.sculpt.finishInherit}
        </button>
        {MATERIALS.map((m) => (
          <button key={m} className={value === m ? 'active' : ''} aria-pressed={value === m} onClick={() => onChange(m)}>
            {t.sculpt.materials[m]}
          </button>
        ))}
      </div>
    </>
  )
}

/** Più forme selezionate: operazione, colore e finitura per tutte, raggruppa, duplica, elimina */
function MultiInspector({ doc, ids }: { doc: SculptDoc; ids: string[] }) {
  const t = useT()
  const nodes = doc.nodes.filter((n) => ids.includes(n.id))
  const sameParent = nodes.every((n) => n.parentId === nodes[0]?.parentId)
  const common = <K extends keyof SculptNode>(key: K) => (nodes.every((n) => n[key] === nodes[0][key]) ? nodes[0][key] : undefined)
  const op = common('op')
  const material = common('material')
  const shapes = nodes.filter((n) => n.kind !== 'group')
  return (
    <section>
      <h3>{t.sculpt.multi(nodes.length)}</h3>
      <span className="field-label">{t.sculpt.op}</span>
      <div className="segmented wide">
        {(['add', 'subtract', 'intersect'] as const).map((o) => (
          <button key={o} className={op === o ? 'active' : ''} aria-pressed={op === o} onClick={() => updateNodes(ids, { op: o })} title={`${t.sculpt.ops[o]} (${t.sculpt.opKeys[o]})`}>
            <Icon icon={OP_ICONS[o]} /> {t.sculpt.ops[o]}
          </button>
        ))}
      </div>
      {shapes.length > 0 && (
        <>
          <label className="field">
            <span>{t.props.color}</span>
            <input type="color" value={shapes[0].color} onChange={(e) => updateNodes(shapes.map((n) => n.id), { color: e.target.value })} />
          </label>
          <FinishPicker value={material === undefined ? null : material} onChange={(m) => updateNodes(shapes.map((n) => n.id), { material: m })} />
        </>
      )}
      <div className="actions">
        <button onClick={() => duplicateNodes(ids)} title={`${t.props.duplicate} (Ctrl+D)`}>
          <Icon icon={faClone} /> {t.props.duplicate}
        </button>
        <button disabled={!sameParent} onClick={() => groupNodes(ids)} title={sameParent ? `${t.sculpt.group} (Ctrl+G)` : t.sculpt.sameLevel}>
          <Icon icon={faFolderPlus} /> {t.sculpt.group}
        </button>
        <button className="danger" onClick={() => deleteNodes(ids)} title={`${t.props.delete} (Del)`}>
          <Icon icon={faTrashCan} /> {t.props.delete}
        </button>
      </div>
    </section>
  )
}

export function NodeInspector() {
  const t = useT()
  const doc = useProject((s) => s.project.sculpt)
  const selection = useUi((s) => s.selection)
  const node = doc && selection?.type === 'node' ? doc.nodes.find((n) => n.id === selection.id) : undefined
  if (!doc) return null
  if (selection?.type === 'nodes') return <MultiInspector doc={doc} ids={selection.ids} />
  if (!node) {
    return (
      <section>
        <h3>{t.props.properties}</h3>
        <p className="hint">{t.sculpt.noSelection}</p>
      </section>
    )
  }
  const isGroup = node.kind === 'group'
  const set = (patch: Partial<SculptNode>, history = true) => updateNode(node.id, patch, history)
  const vec = (key: 'position' | 'rotation' | 'size', i: number, v: number) => {
    const next = [...node[key]] as Vec3
    next[i] = key === 'rotation' ? normDeg(v) : v
    set({ [key]: next })
  }
  const roundMax = Math.min(...node.size) / 2
  const canRound = !isGroup && node.kind !== 'torus' && node.kind !== 'capsule'

  return (
    <section>
      <h3>
        <Icon icon={SHAPE_ICONS[node.kind]} /> {isGroup ? t.sculpt.group : t.sculpt.shapes[node.kind]}
      </h3>
      <label className="field wide">
        <span>{t.props.name}</span>
        <input value={node.name} onChange={(e) => set({ name: e.target.value }, false)} />
      </label>

      <span className="field-label">{t.sculpt.op}</span>
      <div className="segmented wide">
        {(['add', 'subtract', 'intersect'] as const).map((op) => (
          <button key={op} className={node.op === op ? 'active' : ''} aria-pressed={node.op === op} onClick={() => set({ op })} title={`${t.sculpt.ops[op]} (${t.sculpt.opKeys[op]})`}>
            <Icon icon={OP_ICONS[op]} /> {t.sculpt.ops[op]}
          </button>
        ))}
      </div>

      <SliderField label={t.sculpt.blend} value={node.blend} max={0.15} onChange={(v) => set({ blend: v }, false)} />
      {canRound && <SliderField label={t.sculpt.round} value={Math.min(node.round, roundMax)} max={roundMax} onChange={(v) => set({ round: v }, false)} />}

      <SliderField label={t.sculpt.shell} value={node.shell} max={Math.max(0.005, Math.min(...node.size) / 2)} onChange={(v) => set({ shell: v }, false)} />

      {!isGroup && (
        <>
          <label className="field">
            <span>{t.props.color}</span>
            <input type="color" value={node.color} onChange={(e) => set({ color: e.target.value })} />
          </label>
          <FinishPicker value={node.material} onChange={(material) => set({ material })} />
          <span className="field-label" title={t.sculpt.mirrorHint}>
            {t.sculpt.mirror}
          </span>
          <div className="segmented wide">
            {(['x', 'y', 'z'] as const).map((a) => (
              <button
                key={a}
                className={node.mirror[a] ? 'active' : ''}
                aria-pressed={node.mirror[a]}
                title={t.sculpt.mirrorHint}
                onClick={() => set({ mirror: { ...node.mirror, [a]: !node.mirror[a] } })}
              >
                {a.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      <h4>{isGroup ? t.sculpt.scale : t.props.dimensions}</h4>
      <div className="fields three">
        {(['X', 'Y', 'Z'] as const).map((axis, i) =>
          isGroup ? (
            <NumField key={axis} label={axis} value={node.size[i]} kind="percent" min={0.01} onCommit={(v) => vec('size', i, v)} />
          ) : (
            <NumField key={axis} label={axis} value={node.size[i]} min={0.001} onCommit={(v) => vec('size', i, v)} />
          ),
        )}
      </div>
      <h4>{t.props.position}</h4>
      <div className="fields three">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <NumField key={axis} label={axis} value={node.position[i]} onCommit={(v) => vec('position', i, v)} />
        ))}
      </div>
      <h4>{t.props.rotation}</h4>
      <div className="fields three">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <NumField key={axis} label={axis} value={node.rotation[i]} kind="angle" onCommit={(v) => vec('rotation', i, v)} />
        ))}
      </div>

      <div className="actions">
        <button onClick={() => duplicateNodes([node.id])} title={`${t.props.duplicate} (Ctrl+D)`}>
          <Icon icon={faClone} /> {t.props.duplicate}
        </button>
        {isGroup ? (
          <button onClick={() => ungroupNode(node.id)} title={`${t.sculpt.ungroup} (Ctrl+Shift+G)`}>
            <Icon icon={faObjectUngroup} /> {t.sculpt.ungroup}
          </button>
        ) : (
          <button onClick={() => groupNodes([node.id])} title={t.sculpt.newGroup}>
            <Icon icon={faFolderPlus} /> {t.sculpt.group}
          </button>
        )}
        <button className="danger" onClick={() => deleteNodes([node.id])} title={`${t.props.delete} (Del)`}>
          <Icon icon={faTrashCan} /> {t.props.delete}
        </button>
      </div>
    </section>
  )
}
