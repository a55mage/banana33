import { faDoorOpen, faTrowelBricks, faWindowMaximize, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useUi } from '../store/uiStore'
import { useT } from '../i18n'
import { Icon } from './Icon'

const ICONS = { wall: faTrowelBricks, door: faDoorOpen, window: faWindowMaximize }

/** Avviso sopra la vista quando è attivo uno strumento di disegno, con uscita rapida */
export function ToolBanner() {
  const t = useT()
  const tool = useUi((s) => s.tool)
  if (tool === 'select') return null
  return (
    <div className="tool-banner" role="status">
      <Icon icon={ICONS[tool]} />
      <strong>{t.tools[tool]}</strong>
      <span>{t.hints[tool]}</span>
      <button className="icon" onClick={() => useUi.getState().setTool('select')} title={t.tools.exit} aria-label={t.tools.exit}>
        <Icon icon={faXmark} />
      </button>
    </div>
  )
}
