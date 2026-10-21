import { faCircleCheck, faEyeSlash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { findCollisions } from '../geometry/collision'
import { formatLength } from '../units'
import { useT } from '../i18n'
import { Icon } from './Icon'

export function StatusBar() {
  const t = useT()
  const project = useProject((s) => s.project)
  const cursor = useUi((s) => s.cursor)
  const showCollisions = useUi((s) => s.showCollisions)
  const { ids, outOfBounds } = findCollisions(project)
  return (
    <footer className="statusbar">
      {project.kind === 'model' ? null : !showCollisions ? (
        <span>
          <Icon icon={faEyeSlash} /> {t.status.hidden}
        </span>
      ) : ids.size === 0 ? (
        <span className="ok">
          <Icon icon={faCircleCheck} /> {t.status.noCollisions}
        </span>
      ) : (
        <span className="warn">
          <Icon icon={faTriangleExclamation} /> {t.status.conflicts(ids.size)}
          {outOfBounds > 0 && t.status.outOfBounds(outOfBounds)}
        </span>
      )}
      <span>
        {project.kind === 'model'
          ? t.sculpt.count(project.sculpt?.nodes.filter((n) => n.kind !== 'group').length ?? 0)
          : t.status.counts(project.objects.length, project.walls.length, project.openings.length)}
      </span>
      <span className="mono">{cursor ? `x ${formatLength(cursor[0], project.unit)} · y ${formatLength(cursor[1], project.unit)}` : ''}</span>
    </footer>
  )
}
