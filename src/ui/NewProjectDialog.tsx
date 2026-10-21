import { useEffect, useRef } from 'react'
import { faCubes, faPenRuler, faVectorSquare, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { newProject } from '../model/factory'
import type { ProjectKind } from '../model/schema'
import { useT } from '../i18n'
import { Icon, type IconSource } from './Icon'

export const KIND_ICONS: Record<ProjectKind, IconSource> = {
  space: faVectorSquare,
  plan: faPenRuler,
  model: faCubes,
}

/** La modellazione 3D arriva con le fasi successive del piano */
const AVAILABLE: Record<ProjectKind, boolean> = { space: true, plan: true, model: false }

/** Scelta del tipo di progetto: una volta creato, il tipo non cambia più */
export function NewProjectDialog() {
  const t = useT()
  const show = useUi((s) => s.showNewProject)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (show) first.current?.focus()
  }, [show])

  if (!show) return null
  const close = () => useUi.getState().setShowNewProject(false)
  const create = (kind: ProjectKind) => {
    if (kind === 'model') return
    useProject.getState().load(newProject(kind))
    // una planimetria vuota parte direttamente dal disegno dei muri
    if (kind === 'plan') useUi.getState().setTool('wall')
    close()
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal new-project"
        role="dialog"
        aria-modal="true"
        aria-label={t.newProject.title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            close()
          }
        }}
      >
        <header>
          <h2>{t.newProject.title}</h2>
          <button className="icon" onClick={close} aria-label={t.help.close}>
            <Icon icon={faXmark} />
          </button>
        </header>
        <div className="kind-cards">
          {(Object.keys(KIND_ICONS) as ProjectKind[]).map((kind, i) => (
            <button
              key={kind}
              ref={i === 0 ? first : undefined}
              className="kind-card"
              disabled={!AVAILABLE[kind]}
              onClick={() => create(kind)}
            >
              <span className="kind-icon">
                <Icon icon={KIND_ICONS[kind]} />
              </span>
              <strong>{t.newProject.kinds[kind].name}</strong>
              <span className="kind-desc">{t.newProject.kinds[kind].desc}</span>
              {!AVAILABLE[kind] && <span className="badge soon">{t.newProject.comingSoon}</span>}
            </button>
          ))}
        </div>
        <p className="hint">{t.newProject.fixedHint}</p>
      </div>
    </div>
  )
}
