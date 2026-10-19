import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { findCollisions } from '../geometry/collision'

export function StatusBar() {
  const project = useProject((s) => s.project)
  const cursor = useUi((s) => s.cursor)
  const { ids, outOfBounds } = findCollisions(project)
  return (
    <footer className="statusbar">
      {ids.size === 0 ? (
        <span className="ok">✓ Nessuna collisione</span>
      ) : (
        <span className="warn">
          ⚠ {ids.size} oggetti in conflitto{outOfBounds > 0 && ` (${outOfBounds} fuori dallo spazio)`}
        </span>
      )}
      <span>
        {project.objects.length} oggetti · {project.walls.length} muri · {project.openings.length} aperture
      </span>
      <span className="mono">{cursor ? `x ${Math.round(cursor[0] * 100)} · y ${Math.round(cursor[1] * 100)} cm` : ''}</span>
    </footer>
  )
}
