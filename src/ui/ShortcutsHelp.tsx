import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useUi } from '../store/uiStore'
import { useT } from '../i18n'
import { Icon } from './Icon'

export function ShortcutsHelp() {
  const t = useT()
  const show = useUi((s) => s.showHelp)
  if (!show) return null
  const close = () => useUi.getState().setShowHelp(false)
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-label={t.help.title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{t.help.title}</h2>
          <button className="icon" onClick={close} aria-label={t.help.close}>
            <Icon icon={faXmark} />
          </button>
        </header>
        {t.help.groups.map((g) => (
          <section key={g.group}>
            <h3>{g.group}</h3>
            <dl>
              {g.items.map(([keys, desc]) => (
                <div key={keys + desc}>
                  <dt>
                    {keys.split(' / ').map((k, i) => (
                      <span key={k}>
                        {i > 0 && ' / '}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
