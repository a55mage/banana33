import type { Unit } from './model/schema'
import { useProject } from './store/projectStore'

export interface UnitDef {
  label: string
  /** quante unità in un metro */
  factor: number
  /** decimali nei campi di input */
  decimals: number
  system: 'metric' | 'imperial'
}

export const UNITS: Record<Unit, UnitDef> = {
  mm: { label: 'mm', factor: 1000, decimals: 0, system: 'metric' },
  cm: { label: 'cm', factor: 100, decimals: 1, system: 'metric' },
  m: { label: 'm', factor: 1, decimals: 3, system: 'metric' },
  in: { label: 'in', factor: 1 / 0.0254, decimals: 2, system: 'imperial' },
  ft: { label: 'ft', factor: 1 / 0.3048, decimals: 3, system: 'imperial' },
}

/** passi di aggancio (in metri) adatti a ciascun sistema di misura */
export const SNAP_STEPS: Record<UnitDef['system'], number[]> = {
  metric: [0, 0.01, 0.05, 0.1, 0.5],
  imperial: [0, 0.0254, 0.1524, 0.3048],
}

/** griglia: cella e sezione in metri */
export const GRID: Record<UnitDef['system'], { cell: number; section: number }> = {
  metric: { cell: 0.1, section: 1 },
  imperial: { cell: 0.1524, section: 1.524 },
}

export function toUnit(m: number, unit: Unit, decimals = UNITS[unit].decimals) {
  const k = 10 ** decimals
  return Math.round(m * UNITS[unit].factor * k) / k
}

export function formatLength(m: number, unit: Unit, decimals = UNITS[unit].decimals) {
  const v = toUnit(m, unit, decimals).toLocaleString('it-IT', { useGrouping: false, maximumFractionDigits: decimals })
  return `${v} ${UNITS[unit].label}`
}

export const useUnit = () => useProject((s) => s.project.unit)
