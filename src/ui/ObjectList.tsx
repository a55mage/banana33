import { useState, type DragEvent, type MouseEvent } from 'react'
import { faFolderPlus, faGripVertical, faLayerGroup, faLock, faObjectUngroup } from '@fortawesome/free-solid-svg-icons'
import { useProject, createGroup, moveObjectsInList, selectObject, selectedObjectIds, ungroup } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { findCollisions } from '../geometry/collision'
import type { SceneObject } from '../model/schema'
import { useT } from '../i18n'
import { Icon } from './Icon'

const isAdditive = (e: MouseEvent) => e.ctrlKey || e.metaKey || e.shiftKey
const MIME = 'application/x-banana33-objects'

/** Dove cadrebbe il trascinamento: prima di un oggetto, dentro un gruppo o in fondo (fuori dai gruppi) */
type DropTarget = { kind: 'before'; id: string } | { kind: 'group'; id: string } | { kind: 'end' } | null

/** Elenco degli oggetti in scena: gruppi con i loro membri, riordinabile e trascinabile nei gruppi */
export function ObjectList() {
  const t = useT()
  const project = useProject((s) => s.project)
  const selection = useUi((s) => s.selection)
  const showCollisions = useUi((s) => s.showCollisions)
  const [drop, setDrop] = useState<DropTarget>(null)
  const { ids: colliding } = findCollisions(project)
  const selected = new Set(selectedObjectIds(selection, project))

  const onDragStart = (e: DragEvent, o: SceneObject) => {
    // trascinando un oggetto già selezionato insieme ad altri si spostano tutti
    const ids = selected.has(o.id) && selected.size > 1 ? [...selected] : [o.id]
    e.dataTransfer.setData(MIME, JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }
  const over = (target: Exclude<DropTarget, null>) => (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(MIME)) return
    e.preventDefault()
    e.stopPropagation()
    setDrop(target)
  }
  const onDrop = (target: Exclude<DropTarget, null>) => (e: DragEvent) => {
    const raw = e.dataTransfer.getData(MIME)
    setDrop(null)
    if (!raw) return
    e.preventDefault()
    e.stopPropagation()
    const ids: string[] = JSON.parse(raw)
    if (target.kind === 'group') moveObjectsInList(ids, { groupId: target.id })
    else if (target.kind === 'end') moveObjectsInList(ids, { groupId: null })
    else {
      // prima di un oggetto: si entra anche nel suo gruppo (o se ne esce)
      const before = project.objects.find((o) => o.id === target.id)
      moveObjectsInList(ids, { groupId: before?.groupId ?? null, beforeId: target.id })
    }
  }
  const isDrop = (kind: string, id?: string) => drop?.kind === kind && (!id || ('id' in drop && drop.id === id))

  const row = (o: SceneObject, nested: boolean) => (
    <li
      key={o.id}
      draggable
      onDragStart={(e) => onDragStart(e, o)}
      onDragEnd={() => setDrop(null)}
      onDragOver={over({ kind: 'before', id: o.id })}
      onDrop={onDrop({ kind: 'before', id: o.id })}
      className={[selected.has(o.id) && 'active', nested && 'nested', isDrop('before', o.id) && 'drop-before'].filter(Boolean).join(' ')}
      // nella lista si può selezionare anche un singolo oggetto di un gruppo
      onClick={(e) => selectObject(o.id, { additive: isAdditive(e) })}
    >
      <span className="grip" aria-hidden="true">
        <Icon icon={faGripVertical} />
      </span>
      <span className="swatch" style={{ background: o.color }} />
      <span className="grow">{o.name}</span>
      {o.locked && (
        <span className="muted" title={t.sidebar.locked}>
          <Icon icon={faLock} />
        </span>
      )}
      {showCollisions && colliding.has(o.id) && <span className="badge warn">{t.sidebar.collision}</span>}
    </li>
  )

  const ungrouped = project.objects.filter((o) => !o.groupId)
  return (
    <section>
      <div className="heading-row">
        <h3>
          {t.sidebar.objects} ({project.objects.length})
        </h3>
        <button className="icon-btn small" onClick={createGroup} title={t.props.newGroupTitle} aria-label={t.props.newGroup}>
          <Icon icon={faFolderPlus} />
        </button>
      </div>
      <ul className="list" onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
        {project.groups.map((g) => {
          const members = project.objects.filter((o) => o.groupId === g.id)
          const active = selection?.type === 'group' && selection.id === g.id
          return (
            <li key={g.id} className="group-block" onDragOver={over({ kind: 'group', id: g.id })} onDrop={onDrop({ kind: 'group', id: g.id })}>
              <div
                className={['group-row', active && 'active', isDrop('group', g.id) && 'drop-into'].filter(Boolean).join(' ')}
                onClick={(e) =>
                  isAdditive(e) && members.length
                    ? selectObject(members[0].id, { additive: true, wholeGroup: true })
                    : useUi.getState().setSelection({ type: 'group', id: g.id })
                }
              >
                <Icon icon={faLayerGroup} />
                <span className="grow">{g.name}</span>
                <small>{t.props.members(members.length)}</small>
                <button
                  className="icon"
                  title={t.props.ungroup}
                  aria-label={t.props.ungroup}
                  onClick={(e) => {
                    e.stopPropagation()
                    ungroup(g.id)
                  }}
                >
                  <Icon icon={faObjectUngroup} />
                </button>
              </div>
              <ul className="list">
                {members.map((o) => row(o, true))}
                {members.length === 0 && <li className="nested empty-group">{t.props.emptyGroup}</li>}
              </ul>
            </li>
          )
        })}
        {ungrouped.map((o) => row(o, false))}
        {/* zona finale: porta gli oggetti fuori dai gruppi, in fondo alla lista */}
        <li className={`drop-end${isDrop('end') ? ' active-drop' : ''}`} onDragOver={over({ kind: 'end' })} onDrop={onDrop({ kind: 'end' })}>
          {project.objects.length === 0 ? t.props.noObjects : t.props.dropHere}
        </li>
      </ul>
      <p className="hint">{t.props.selectHint}</p>
    </section>
  )
}
