import type { Vec2 } from '../model/schema'

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1]
export const len = (a: Vec2) => Math.hypot(a[0], a[1])
export const dist = (a: Vec2, b: Vec2) => len(sub(a, b))
export const deg2rad = (d: number) => (d * Math.PI) / 180

export function normalize(a: Vec2): Vec2 {
  const l = len(a)
  return l === 0 ? [0, 0] : [a[0] / l, a[1] / l]
}

export const snapValue = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)
