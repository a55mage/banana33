import {
  faClockRotateLeft,
  faClone,
  faDownLeftAndUpRightToCenter,
  faLayerGroup,
  faLink,
  faLinkSlash,
  faLock,
  faLockOpen,
  faObjectGroup,
  faObjectUngroup,
  faRotateLeft,
  faRotateRight,
  faTrashCan,
  faUpRightAndDownLeftFromCenter,
} from '@fortawesome/free-solid-svg-icons'
import {
  useProject,
  updateObject,
  deleteSelection,
  duplicateSelection,
  scaleSelection,
  rotateSelection,
  groupSelection,
  ungroup,
  removeFromGroup,
  renameGroup,
  centerOf,
  moveSelectionTo,
  setSelectionLocked,
  selectedObjectIds,
  resetObject,
} from '../store/projectStore'
import { useUi } from '../store/uiStore'
import type { Group, Opening, SceneObject, Wall } from '../model/schema'
import { wallFrame } from '../geometry/walls'
import { useT } from '../i18n'
import { NumField } from './NumField'
import { Icon } from './Icon'
import { ObjectList } from './ObjectList'

const normDeg = (v: number) => ((v % 360) + 360) % 360

/** Azioni comuni a oggetto, gruppo e selezione multipla */
function SelectionActions({ locked }: { locked: boolean }) {
  const t = useT()
  return (
    <div className="actions">
      <button className="icon-btn" onClick={() => rotateSelection(-90)} title={`${t.props.rotateLeft} (Shift+[)`} aria-label={t.props.rotateLeft}>
        <Icon icon={faRotateLeft} />
      </button>
      <button className="icon-btn" onClick={() => rotateSelection(90)} title={`${t.props.rotateRight} (Shift+])`} aria-label={t.props.rotateRight}>
        <Icon icon={faRotateRight} />
      </button>
      <button className="icon-btn" onClick={() => scaleSelection(1.1)} title={t.props.scaleUp} aria-label={t.props.scaleUp}>
        <Icon icon={faUpRightAndDownLeftFromCenter} />
      </button>
      <button className="icon-btn" onClick={() => scaleSelection(1 / 1.1)} title={t.props.scaleDown} aria-label={t.props.scaleDown}>
        <Icon icon={faDownLeftAndUpRightToCenter} />
      </button>
      <button
        className={`icon-btn toggle${locked ? ' on' : ''}`}
        aria-pressed={locked}
        onClick={() => setSelectionLocked(!locked)}
        title={locked ? t.props.unlock : t.props.lock}
        aria-label={locked ? t.props.unlock : t.props.lock}
      >
        <Icon icon={locked ? faLock : faLockOpen} />
      </button>
      <button onClick={duplicateSelection} title={`${t.props.duplicate} (Ctrl+D)`}>
        <Icon icon={faClone} /> {t.props.duplicate}
      </button>
      <button className="danger" onClick={deleteSelection} title={`${t.props.delete} (Del)`}>
        <Icon icon={faTrashCan} /> {t.props.delete}
      </button>
    </div>
  )
}

function ResetButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button className="icon-btn small" onClick={onClick} title={title} aria-label={title}>
      <Icon icon={faClockRotateLeft} />
    </button>
  )
}

function ObjectProps({ o, group }: { o: SceneObject; group: Group | undefined }) {
  const t = useT()
  const set = (patch: Partial<SceneObject>) => updateObject(o.id, patch)
  const setSize = (i: 0 | 1 | 2, v: number) => {
    // con le proporzioni bloccate tutte le dimensioni seguono lo stesso fattore
    const k = v / o.size[i]
    const size: SceneObject['size'] = o.scaleLock ? (o.size.map((x) => Math.max(0.01, Math.round(x * k * 10000) / 10000)) as SceneObject['size']) : [...o.size]
    size[i] = v
    set({ size })
  }
  return (
    <>
      {group && (
        <div className="group-badge">
          <Icon icon={faLayerGroup} />
          <span className="grow">
            {t.props.inGroup}{' '}
            <button className="link" onClick={() => useUi.getState().setSelection({ type: 'group', id: group.id })} title={t.props.selectGroup}>
              {group.name}
            </button>
          </span>
          <button className="icon" onClick={() => removeFromGroup(o.id)} title={t.props.removeFromGroup} aria-label={t.props.removeFromGroup}>
            <Icon icon={faObjectUngroup} />
          </button>
        </div>
      )}
      <label className="field wide">
        <span>{t.props.name}</span>
        <input value={o.name} onChange={(e) => updateObject(o.id, { name: e.target.value }, false)} />
      </label>
      <div className="fields">
        <label className="field">
          <span>{t.props.color}</span>
          <input type="color" value={o.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
        <label className="field">
          <span>{t.props.shape}</span>
          <select
            value={o.model ? 'model' : o.kind}
            onChange={(e) => {
              const v = e.target.value
              if (v !== 'model') set({ kind: v as SceneObject['kind'], model: null })
            }}
          >
            {o.model && <option value="model">{t.props.model}</option>}
            <option value="box">{t.props.box}</option>
            <option value="cylinder">{t.props.cylinder}</option>
            <option value="sphere">{t.props.sphere}</option>
          </select>
        </label>
      </div>
      <div className="heading-row">
        <h4>{t.props.dimensions}</h4>
        <button
          className={`icon-btn small toggle${o.scaleLock ? ' on' : ''}`}
          aria-pressed={o.scaleLock}
          onClick={() => set({ scaleLock: !o.scaleLock })}
          title={o.scaleLock ? t.props.scaleUnlock : t.props.scaleLock}
          aria-label={o.scaleLock ? t.props.scaleUnlock : t.props.scaleLock}
        >
          <Icon icon={o.scaleLock ? faLink : faLinkSlash} />
        </button>
        <ResetButton title={t.props.resetSize} onClick={() => resetObject(o.id, 'size')} />
      </div>
      <div className="fields three">
        <NumField label={t.props.width} value={o.size[0]} min={0.01} onCommit={(v) => setSize(0, v)} />
        <NumField label={t.props.depth} value={o.size[2]} min={0.01} onCommit={(v) => setSize(2, v)} />
        <NumField label={t.props.height} value={o.size[1]} min={0.01} onCommit={(v) => setSize(1, v)} />
      </div>
      <div className="heading-row">
        <h4>{t.props.position}</h4>
        <ResetButton title={t.props.resetPosition} onClick={() => resetObject(o.id, 'position')} />
      </div>
      <div className="fields three">
        <NumField label={t.props.x} value={o.position[0]} onCommit={(v) => set({ position: [v, o.position[1]] })} />
        <NumField label={t.props.y} value={o.position[1]} onCommit={(v) => set({ position: [o.position[0], v] })} />
        <NumField label={t.props.elevation} value={o.elevation} min={0} onCommit={(v) => set({ elevation: v })} />
      </div>
      <div className="heading-row">
        <h4>{t.props.rotation}</h4>
        <button
          className={`icon-btn small toggle${o.rotationLock ? ' on' : ''}`}
          aria-pressed={o.rotationLock}
          onClick={() => set({ rotationLock: !o.rotationLock })}
          title={o.rotationLock ? t.props.rotationUnlock : t.props.rotationLock}
          aria-label={o.rotationLock ? t.props.rotationUnlock : t.props.rotationLock}
        >
          <Icon icon={o.rotationLock ? faLock : faLockOpen} />
        </button>
        <ResetButton title={t.props.resetRotation} onClick={() => resetObject(o.id, 'rotation')} />
      </div>
      <div className="fields three">
        <NumField label="X" value={o.rotationX} kind="angle" onCommit={(v) => set({ rotationX: normDeg(v) })} />
        <NumField label="Y" value={o.rotation} kind="angle" onCommit={(v) => set({ rotation: normDeg(v) })} />
        <NumField label="Z" value={o.rotationZ} kind="angle" onCommit={(v) => set({ rotationZ: normDeg(v) })} />
      </div>
      {(o.rotationX !== 0 || o.rotationZ !== 0) && <p className="hint">{t.props.tiltHint}</p>}
      <SelectionActions locked={o.locked} />
    </>
  )
}

/** Gruppo o selezione multipla: si modificano centro e orientamento dell'insieme */
function SetProps({ ids, group }: { ids: string[]; group?: Group }) {
  const t = useT()
  const project = useProject((s) => s.project)
  const objs = project.objects.filter((o) => ids.includes(o.id))
  const center = centerOf(ids, project)
  const locked = objs.length > 0 && objs.every((o) => o.locked)
  if (group && objs.length === 0) {
    return (
      <>
        <label className="field wide">
          <span>{t.props.name}</span>
          <input value={group.name} onChange={(e) => renameGroup(group.id, e.target.value)} />
        </label>
        <p className="hint">{t.props.emptyGroup}</p>
        <div className="actions">
          <button className="danger" onClick={() => ungroup(group.id)}>
            <Icon icon={faTrashCan} /> {t.props.deleteGroup}
          </button>
        </div>
      </>
    )
  }
  return (
    <>
      {group && (
        <>
          <label className="field wide">
            <span>{t.props.name}</span>
            <input value={group.name} onChange={(e) => renameGroup(group.id, e.target.value)} />
          </label>
          <p className="hint">{t.props.members(objs.length)}</p>
        </>
      )}
      <h4>{t.props.center}</h4>
      <div className="fields">
        <NumField label={t.props.x} value={center[0]} onCommit={(v) => moveSelectionTo([v, center[1]])} />
        <NumField label={t.props.y} value={center[1]} onCommit={(v) => moveSelectionTo([center[0], v])} />
      </div>
      <div className="actions">
        {group ? (
          <button onClick={() => ungroup(group.id)} title={`${t.props.ungroup} (Ctrl+Shift+G)`}>
            <Icon icon={faObjectUngroup} /> {t.props.ungroup}
          </button>
        ) : (
          <button className="primary" onClick={groupSelection} title={`${t.props.makeGroup} (Ctrl+G)`}>
            <Icon icon={faObjectGroup} /> {t.props.makeGroup}
          </button>
        )}
      </div>
      <SelectionActions locked={locked} />
    </>
  )
}

function WallProps({ w }: { w: Wall }) {
  const t = useT()
  const mutate = useProject((s) => s.mutate)
  const edit = (fn: (x: Wall) => void) =>
    mutate((d) => {
      const x = d.walls.find((y) => y.id === w.id)
      if (x) fn(x)
    })
  const { length, dir } = wallFrame(w)
  return (
    <>
      <div className="fields three">
        <NumField
          label={t.props.length}
          value={length}
          min={0.05}
          onCommit={(v) => edit((x) => void (x.b = [x.a[0] + dir[0] * v, x.a[1] + dir[1] * v]))}
        />
        <NumField label={t.props.thickness} value={w.thickness} min={0.01} onCommit={(v) => edit((x) => void (x.thickness = v))} />
        <NumField label={t.props.height} value={w.height} min={0.1} onCommit={(v) => edit((x) => void (x.height = v))} />
      </div>
      <div className="actions">
        <button className="danger" onClick={deleteSelection}>
          <Icon icon={faTrashCan} /> {t.props.deleteWall}
        </button>
      </div>
    </>
  )
}

function OpeningProps({ op }: { op: Opening }) {
  const t = useT()
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
          <span>{t.props.type}</span>
          <select value={op.kind} onChange={(e) => edit({ kind: e.target.value as Opening['kind'] })}>
            <option value="door">{t.props.door}</option>
            <option value="window">{t.props.window}</option>
          </select>
        </label>
        <NumField label={t.props.width} value={op.width} min={0.1} onCommit={(v) => edit({ width: v })} />
        <NumField label={t.props.height} value={op.height} min={0.1} onCommit={(v) => edit({ height: v })} />
        <NumField label={t.props.sill} value={op.sill} min={0} onCommit={(v) => edit({ sill: v })} />
        <NumField label={t.props.offset} value={op.offset} min={0} onCommit={(v) => edit({ offset: v })} />
      </div>
      <p className="hint">{t.props.offsetHint}</p>
      <div className="actions">
        <button className="danger" onClick={deleteSelection}>
          <Icon icon={faTrashCan} /> {t.props.delete}
        </button>
      </div>
    </>
  )
}

export function PropertiesPanel() {
  const t = useT()
  const selection = useUi((s) => s.selection)
  const project = useProject((s) => s.project)

  let body: React.ReactNode = <p className="hint">{t.hints.select}</p>
  let title = t.props.properties
  if (selection?.type === 'object') {
    const o = project.objects.find((x) => x.id === selection.id)
    if (o) {
      title = t.props.object
      body = <ObjectProps key={o.id} o={o} group={project.groups.find((g) => g.id === o.groupId)} />
    }
  } else if (selection?.type === 'group') {
    const g = project.groups.find((x) => x.id === selection.id)
    if (g) {
      title = t.props.group
      body = <SetProps key={g.id} ids={selectedObjectIds(selection, project)} group={g} />
    }
  } else if (selection?.type === 'multi') {
    title = t.props.multi(selection.ids.length)
    body = <SetProps ids={selection.ids} />
  } else if (selection?.type === 'wall') {
    const w = project.walls.find((x) => x.id === selection.id)
    if (w) {
      title = t.props.wall
      body = <WallProps key={w.id} w={w} />
    }
  } else if (selection?.type === 'opening') {
    const op = project.openings.find((x) => x.id === selection.id)
    if (op) {
      title = op.kind === 'door' ? t.props.door : t.props.window
      body = <OpeningProps key={op.id} op={op} />
    }
  }

  return (
    <aside className="panel right">
      <section>
        <h3>{title}</h3>
        {body}
      </section>
      <ObjectList />
    </aside>
  )
}
