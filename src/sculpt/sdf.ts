/*
 * Funzioni di distanza con segno (SDF) in TypeScript. Sono la copia esatta, formula per formula,
 * di quelle GLSL in glsl.ts: servono alla selezione col mouse e all'esportazione della mesh,
 * che devono "vedere" la stessa forma disegnata dalla GPU.
 * Ogni forma è centrata nell'origine; `s` sono le dimensioni complete sui tre assi, `r` l'arrotondamento.
 */

export type V3 = [number, number, number]
export type RGB = [number, number, number]

const len2 = (x: number, y: number) => Math.hypot(x, y)
const len3 = (x: number, y: number, z: number) => Math.hypot(x, y, z)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Arrotondamento: la forma si restringe di r e la superficie si allontana di r (r ≤ metà del lato minore) */
const roundOf = (s: V3, r: number) => Math.min(r, 0.5 * Math.min(s[0], s[1], s[2]) - 1e-4)

/** Ellissoide (sfera se le dimensioni sono uguali); approssimazione di Quilez, esatta per la sfera */
export function sdSphere([x, y, z]: V3, s: V3, round: number): number {
  const r = roundOf(s, round)
  const a = Math.max(s[0] / 2 - r, 1e-4)
  const b = Math.max(s[1] / 2 - r, 1e-4)
  const c = Math.max(s[2] / 2 - r, 1e-4)
  const k0 = len3(x / a, y / b, z / c)
  const k1 = len3(x / (a * a), y / (b * b), z / (c * c))
  return (k1 === 0 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1) - r
}

/** Parallelepipedo con spigoli arrotondati */
export function sdBox([x, y, z]: V3, s: V3, round: number): number {
  const r = Math.max(0, roundOf(s, round))
  const qx = Math.abs(x) - (s[0] / 2 - r)
  const qy = Math.abs(y) - (s[1] / 2 - r)
  const qz = Math.abs(z) - (s[2] / 2 - r)
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}

/** Distanza radiale da un'ellisse nel piano XZ (approssimata, esatta per il cerchio) */
function radial(x: number, z: number, rx: number, rz: number): number {
  const e = len2(x / rx, z / rz)
  return (e - 1) * Math.min(rx, rz)
}

/** Cilindro con asse Y e bordi arrotondati */
export function sdCylinder([x, y, z]: V3, s: V3, round: number): number {
  const r = Math.max(0, roundOf(s, round))
  const dx = radial(x, z, Math.max(s[0] / 2 - r, 1e-4), Math.max(s[2] / 2 - r, 1e-4))
  const dy = Math.abs(y) - (s[1] / 2 - r)
  return Math.min(Math.max(dx, dy), 0) + len2(Math.max(dx, 0), Math.max(dy, 0)) - r
}

/** Cono con base in basso (y = −h/2) e punta in alto; sezione ellittica approssimata */
export function sdCone([x, y, z]: V3, s: V3, round: number): number {
  const r = Math.max(0, roundOf(s, round))
  const h = Math.max(s[1] / 2 - r, 1e-4)
  const rx = Math.max(s[0] / 2 - r, 1e-4)
  const rz = Math.max(s[2] / 2 - r, 1e-4)
  // riporta la sezione ellittica a un cerchio di raggio medio
  const rb = (rx + rz) / 2
  const qx = len2((x / rx) * rb, (z / rz) * rb)
  const qy = y
  // cono tronco di Quilez con raggio in alto 0 (k1 = (r2, h), k2 = (r2 − r1, 2h))
  const k2x = -rb
  const k2y = 2 * h
  const cax = qx - Math.min(qx, qy < 0 ? rb : 0)
  const cay = Math.abs(qy) - h
  const t = clamp(((0 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y), 0, 1)
  const cbx = qx - 0 + k2x * t
  const cby = qy - h + k2y * t
  const sign = cbx < 0 && cay < 0 ? -1 : 1
  return sign * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby)) - r
}

/** Toro sul piano XZ: X/Z diametro esterno, Y spessore dell'anello */
export function sdTorus([x, y, z]: V3, s: V3): number {
  const tube = s[1] / 2
  const major = Math.max((s[0] + s[2]) / 4 - tube, 1e-4)
  return len2(len2(x, z) - major, y) - tube
}

/** Capsula con asse Y: diametro dal lato minore di X/Z, lunghezza totale Y */
export function sdCapsule([x, y, z]: V3, s: V3): number {
  const radius = Math.min(s[0], s[2]) / 2
  const h = Math.max(s[1] / 2 - radius, 0)
  const py = y - clamp(y, -h, h)
  return len3(x, py, z) - radius
}

export type ShapeKind = 'sphere' | 'box' | 'cylinder' | 'cone' | 'torus' | 'capsule'

export function sdShape(kind: ShapeKind, p: V3, s: V3, round: number): number {
  switch (kind) {
    case 'sphere':
      return sdSphere(p, s, round)
    case 'box':
      return sdBox(p, s, round)
    case 'cylinder':
      return sdCylinder(p, s, round)
    case 'cone':
      return sdCone(p, s, round)
    case 'torus':
      return sdTorus(p, s)
    case 'capsule':
      return sdCapsule(p, s)
  }
}

// ---------- operazioni morbide (con colore) ----------

/** Finitura: [intensità del riflesso, lucentezza / 200, metallicità, diffusione "argilla"] */
export type Mat = [number, number, number, number]

export const MATERIAL_PARAMS: Record<'matte' | 'glossy' | 'metal' | 'clay', Mat> = {
  matte: [0.05, 18 / 200, 0, 0],
  glossy: [0.6, 140 / 200, 0, 0],
  metal: [1, 60 / 200, 1, 0],
  clay: [0, 18 / 200, 0, 1],
}

export interface Sample {
  d: number
  c: RGB
  m: Mat
}

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
const mixMat = (a: Mat, b: Mat, t: number): Mat => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)]
const K_MIN = 1e-5

/** Guscio: la forma diventa una parete di spessore t, con la superficie esterna invariata */
export function opShell(d: number, t: number): number {
  return t > 0 ? Math.abs(d + t / 2) - t / 2 : d
}

/** Unione morbida: `k` è il raggio della fusione ("goop") */
export function opUnion(a: Sample, b: Sample, k: number): Sample {
  k = Math.max(k, K_MIN)
  const h = clamp(0.5 + (0.5 * (b.d - a.d)) / k, 0, 1)
  return { d: mix(b.d, a.d, h) - k * h * (1 - h), c: mixRGB(b.c, a.c, h), m: mixMat(b.m, a.m, h) }
}

/** Sottrazione morbida: `b` scava `a`; la superficie scavata prende il colore di `b` */
export function opSubtract(a: Sample, b: Sample, k: number): Sample {
  k = Math.max(k, K_MIN)
  const h = clamp(0.5 - (0.5 * (a.d + b.d)) / k, 0, 1)
  return { d: mix(a.d, -b.d, h) + k * h * (1 - h), c: mixRGB(a.c, b.c, h), m: mixMat(a.m, b.m, h) }
}

/** Intersezione morbida: resta solo la parte comune */
export function opIntersect(a: Sample, b: Sample, k: number): Sample {
  k = Math.max(k, K_MIN)
  const h = clamp(0.5 - (0.5 * (b.d - a.d)) / k, 0, 1)
  return { d: mix(b.d, a.d, h) + k * h * (1 - h), c: mixRGB(b.c, a.c, h), m: mixMat(b.m, a.m, h) }
}

/** Distanza "infinita" iniziale di un gruppo vuoto */
export const FAR = 1e10
