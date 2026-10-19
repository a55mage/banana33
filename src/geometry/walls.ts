import type { Opening, Vec2, Wall } from '../model/schema'
import { dot, len, normalize, sub } from './vec'

export interface WallPiece {
  /** solid = tutta altezza; sill/lintel = sotto/sopra un'apertura (nascosti nella pianta 2D) */
  part: 'solid' | 'sill' | 'lintel'
  center: [number, number, number]
  length: number
  height: number
}

export interface WallFrame {
  length: number
  dir: Vec2
  /** rotation.y che allinea l'asse X locale alla direzione del muro */
  angle: number
}

export function wallFrame(w: Wall): WallFrame {
  const d = sub(w.b, w.a)
  const dir = normalize(d)
  return { length: len(d), dir, angle: Math.atan2(-dir[1], dir[0]) }
}

export function pointAlong(w: Wall, t: number): Vec2 {
  const { dir } = wallFrame(w)
  return [w.a[0] + dir[0] * t, w.a[1] + dir[1] * t]
}

/** Spezza il muro in blocchi pieni attorno alle aperture (estremi estesi di metà spessore) */
export function wallPieces(w: Wall, openings: Opening[]): WallPiece[] {
  const { length } = wallFrame(w)
  const ext = w.thickness / 2
  const pieces: WallPiece[] = []
  const solid = (s: number, e: number, y0: number, y1: number, part: WallPiece['part'] = 'solid') => {
    if (e - s < 1e-4 || y1 - y0 < 1e-4) return
    const [x, z] = pointAlong(w, (s + e) / 2)
    pieces.push({ part, center: [x, (y0 + y1) / 2, z], length: e - s, height: y1 - y0 })
  }
  let cursor = -ext
  const sorted = openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offset - b.offset)
  for (const op of sorted) {
    const s = Math.max(cursor, op.offset - op.width / 2)
    const e = Math.min(length + ext, op.offset + op.width / 2)
    if (e <= s) continue
    solid(cursor, s, 0, w.height)
    solid(s, e, 0, Math.min(op.sill, w.height), 'sill')
    solid(s, e, Math.min(op.sill + op.height, w.height), w.height, 'lintel')
    cursor = e
  }
  solid(cursor, length + ext, 0, w.height)
  return pieces
}

/** Distanza lungo il muro della proiezione di un punto, limitata perché l'apertura stia nel muro */
export function offsetOnWall(w: Wall, p: Vec2, openingWidth: number): number | null {
  const { length, dir } = wallFrame(w)
  if (openingWidth > length) return null
  const t = dot(sub(p, w.a), dir)
  return Math.min(Math.max(t, openingWidth / 2), length - openingWidth / 2)
}
