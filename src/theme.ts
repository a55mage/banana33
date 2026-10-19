import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'

export type ThemePref = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'banana33:theme'

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const useThemePref = create<{ pref: ThemePref; setPref: (p: ThemePref) => void }>((set) => ({
  pref: readPref(),
  setPref: (pref) => {
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      // preferenza non salvata: vale solo per questa sessione
    }
    set({ pref })
  },
}))

const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const subscribeMedia = (cb: () => void) => {
  const m = media()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

export function useResolvedTheme(): ResolvedTheme {
  const pref = useThemePref((s) => s.pref)
  const systemDark = useSyncExternalStore(subscribeMedia, () => media().matches)
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

/** Applica il tema al documento (le variabili CSS dipendono da data-theme) */
export function useApplyTheme() {
  const theme = useResolvedTheme()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])
}

/** Colori della scena 3D, che non possono leggere le variabili CSS */
export interface SceneTheme {
  gridCell: string
  gridSection: string
  floor: string
  spaceEdge: string
  spaceFill: string
  spaceFillOpacity: number
  wallPlan: string
  wall3d: string
  selected: string
  collision: string
  edge: string
  doorPlan: string
  shadowOpacity: number
  ambient: number
  sun: number
  sunColor: string
}

export const SCENE_THEMES: Record<ResolvedTheme, SceneTheme> = {
  light: {
    gridCell: '#dde1d6',
    gridSection: '#b9c0ad',
    floor: '#ffffff',
    spaceEdge: '#749e35',
    spaceFill: '#8abc40',
    spaceFillOpacity: 0.04,
    wallPlan: '#3b4233',
    wall3d: '#e4e6df',
    selected: '#ff9d00',
    collision: '#d6423f',
    edge: '#3b4233',
    doorPlan: '#6b5a40',
    shadowOpacity: 0.14,
    ambient: 0.75,
    sun: 1.2,
    sunColor: '#ffffff',
  },
  dark: {
    gridCell: '#23271f',
    gridSection: '#363c2f',
    floor: '#1d2019',
    spaceEdge: '#8abc40',
    spaceFill: '#8abc40',
    spaceFillOpacity: 0.04,
    wallPlan: '#c9cfbf',
    wall3d: '#8d9286',
    selected: '#ff9d00',
    collision: '#ff6b66',
    edge: '#c9cfbf',
    doorPlan: '#d9b77e',
    shadowOpacity: 0.3,
    ambient: 0.55,
    sun: 1.0,
    sunColor: '#ffffff',
  },
}

export const useSceneTheme = () => SCENE_THEMES[useResolvedTheme()]
