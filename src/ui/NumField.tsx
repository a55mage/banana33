import { useEffect, useState } from 'react'

interface Props {
  label: string
  /** valore in metri (o gradi) */
  value: number
  onCommit: (v: number) => void
  /** fattore di visualizzazione: 100 per mostrare i metri in cm */
  factor?: number
  unit?: string
  min?: number
}

const fmt = (v: number) => String(Math.round(v * 100) / 100)

/** Campo numerico che accetta la virgola e applica il valore solo a conferma (Invio o uscita) */
export function NumField({ label, value, onCommit, factor = 100, unit = 'cm', min }: Props) {
  const [text, setText] = useState(fmt(value * factor))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(fmt(value * factor))
  }, [value, factor, focused])

  const commit = () => {
    const n = parseFloat(text.replace(',', '.'))
    if (!Number.isFinite(n)) return setText(fmt(value * factor))
    let v = n / factor
    if (min !== undefined) v = Math.max(min, v)
    if (Math.abs(v - value) > 1e-9) onCommit(v)
    else setText(fmt(value * factor))
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          commit()
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setText(fmt(value * factor))
            e.currentTarget.blur()
          }
        }}
      />
      <em>{unit}</em>
    </label>
  )
}
