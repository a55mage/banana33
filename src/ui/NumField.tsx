import { useEffect, useState } from 'react'
import { UNITS, useUnit } from '../units'

interface Props {
  label: string
  /** valore in metri (o gradi per kind="angle") */
  value: number
  onCommit: (v: number) => void
  kind?: 'length' | 'angle'
  min?: number
}

/** Campo numerico nell'unità del progetto: accetta la virgola e applica il valore solo a conferma */
export function NumField({ label, value, onCommit, kind = 'length', min }: Props) {
  const unit = useUnit()
  const { factor, label: unitLabel, decimals } = kind === 'angle' ? { factor: 1, label: '°', decimals: 1 } : UNITS[unit]
  const fmt = (v: number) => {
    const k = 10 ** (decimals + 1)
    return String(Math.round(v * factor * k) / k).replace('.', ',')
  }
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, factor, focused])

  const commit = () => {
    const n = parseFloat(text.replace(',', '.'))
    if (!Number.isFinite(n)) return setText(fmt(value))
    let v = n / factor
    if (min !== undefined) v = Math.max(min, v)
    if (Math.abs(v - value) > 1e-9) onCommit(v)
    else setText(fmt(value))
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
            setText(fmt(value))
            e.currentTarget.blur()
          }
        }}
      />
      <em>{unitLabel}</em>
    </label>
  )
}
