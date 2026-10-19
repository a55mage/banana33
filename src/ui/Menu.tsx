import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { Icon, type IconSource } from './Icon'

export type MenuEntry = { icon: IconSource; label: string; title?: string; onSelect: () => void } | 'separator'

interface Props {
  icon: IconSource
  label: string
  items: MenuEntry[]
}

/** Pulsante con menu a tendina: si chiude con clic esterno, Esc o dopo una scelta */
export function Menu({ icon, label, items }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    list.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    // le scorciatoie globali non devono ricevere i tasti usati nel menu
    e.stopPropagation()
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      setOpen(false)
      root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      buttons[(i + 1) % buttons.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus()
    }
  }

  return (
    <div className="menu" ref={root} onKeyDown={onKeyDown}>
      <button aria-haspopup="menu" aria-expanded={open} className={open ? 'open' : ''} onClick={() => setOpen((v) => !v)}>
        <Icon icon={icon} /> {label} <Icon icon={faChevronDown} className="chevron" />
      </button>
      {open && (
        <div className="menu-list" role="menu" ref={list} aria-label={label}>
          {items.map((it, i) =>
            it === 'separator' ? (
              <hr key={i} />
            ) : (
              <button
                key={i}
                role="menuitem"
                title={it.title}
                onClick={() => {
                  setOpen(false)
                  it.onSelect()
                }}
              >
                <Icon icon={it.icon} /> {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
