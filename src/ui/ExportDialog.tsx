import { useEffect, useRef, useState } from 'react'
import { faCircleCheck, faCube, faFileExport, faPrint, faTriangleExclamation, faXmark, faPalette } from '@fortawesome/free-solid-svg-icons'
import { useProject } from '../store/projectStore'
import { useUi } from '../store/uiStore'
import { exportModel, type ExportFormat, type ExportJob, type ExportResult, type ExportUnit } from '../sculpt/exportModel'
import type { Quality } from '../sculpt/mesh'
import { downloadBlob } from '../persistence/file'
import { useT } from '../i18n'
import { Icon, type IconSource } from './Icon'

const FORMATS: { id: ExportFormat; icon: IconSource }[] = [
  { id: 'stl', icon: faPrint },
  { id: 'obj', icon: faPalette },
  { id: 'glb', icon: faCube },
]
const QUALITIES: Quality[] = ['draft', 'medium', 'high']

const fileSize = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} kB`)

type State = { phase: 'idle' } | { phase: 'working'; progress: number } | { phase: 'done'; result: ExportResult } | { phase: 'empty' } | { phase: 'error'; message: string }

/** Esportazione della mesh del modello 3D (STL per la stampa, OBJ e GLB con i colori) */
export function ExportDialog() {
  const t = useT()
  const show = useUi((s) => s.showExport)
  const [format, setFormat] = useState<ExportFormat>('stl')
  const [quality, setQuality] = useState<Quality>('medium')
  const [unit, setUnit] = useState<ExportUnit>('mm')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const job = useRef<ExportJob | null>(null)

  // chiudendo la finestra si annulla un calcolo in corso
  useEffect(() => {
    if (!show) {
      job.current?.cancel()
      job.current = null
      setState({ phase: 'idle' })
    }
  }, [show])

  if (!show) return null
  const close = () => useUi.getState().setShowExport(false)

  const run = async () => {
    const { project } = useProject.getState()
    if (!project.sculpt) return
    setState({ phase: 'working', progress: 0 })
    const current = exportModel(project.sculpt, { format, quality, unit, name: project.name }, (progress) =>
      setState((s) => (s.phase === 'working' ? { phase: 'working', progress } : s)),
    )
    job.current = current
    try {
      const result = await current.promise
      if (job.current !== current) return // annullato
      job.current = null
      if (!result) return setState({ phase: 'empty' })
      downloadBlob(result.blob, result.filename)
      setState({ phase: 'done', result })
    } catch (err) {
      job.current = null
      setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const working = state.phase === 'working'
  return (
    <div className="modal-backdrop" onClick={working ? undefined : close}>
      <div
        className="modal export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.export.title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            close()
          }
        }}
      >
        <header>
          <h2>{t.export.title}</h2>
          <button className="icon" onClick={close} aria-label={t.help.close}>
            <Icon icon={faXmark} />
          </button>
        </header>

        <span className="field-label">{t.export.format}</span>
        <div className="format-cards">
          {FORMATS.map((f) => (
            <button key={f.id} className={`format-card${format === f.id ? ' active' : ''}`} aria-pressed={format === f.id} disabled={working} onClick={() => setFormat(f.id)}>
              <Icon icon={f.icon} />
              <strong>{f.id.toUpperCase()}</strong>
              <span>{t.export.formats[f.id]}</span>
            </button>
          ))}
        </div>

        <span className="field-label">{t.export.quality}</span>
        <div className="segmented wide">
          {QUALITIES.map((q) => (
            <button key={q} className={quality === q ? 'active' : ''} aria-pressed={quality === q} disabled={working} onClick={() => setQuality(q)}>
              {t.export.qualities[q]}
            </button>
          ))}
        </div>

        {format !== 'glb' ? (
          <>
            <span className="field-label">{t.export.unit}</span>
            <div className="segmented wide">
              {(['mm', 'm'] as const).map((u) => (
                <button key={u} className={unit === u ? 'active' : ''} aria-pressed={unit === u} disabled={working} onClick={() => setUnit(u)}>
                  {t.export.units[u]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="hint">{t.export.glbMeters}</p>
        )}

        {working && (
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress * 100)}>
            <div style={{ width: `${Math.round(state.progress * 100)}%` }} />
            <span>{t.export.working}</span>
          </div>
        )}
        {state.phase === 'done' && (
          <p className={`export-result${state.result.issues ? ' warn' : ' ok'}`}>
            <Icon icon={state.result.issues ? faTriangleExclamation : faCircleCheck} />{' '}
            {t.export.done(state.result.filename, state.result.triangles.toLocaleString(t.locale), fileSize(state.result.blob.size))}
            {state.result.issues > 0 && <> {t.export.issues(state.result.issues)}</>}
          </p>
        )}
        {state.phase === 'empty' && <p className="hint strong">{t.export.empty}</p>}
        {state.phase === 'error' && <p className="hint warn">{state.message}</p>}

        <div className="actions end">
          <button onClick={close}>{working ? t.export.cancel : t.help.close}</button>
          <button className="primary" disabled={working} onClick={run}>
            <Icon icon={faFileExport} /> {t.export.run}
          </button>
        </div>
      </div>
    </div>
  )
}
