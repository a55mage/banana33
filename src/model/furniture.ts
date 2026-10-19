/**
 * Modelli 3D di arredo costruiti con parti primitive, calcolate dalle dimensioni
 * dell'oggetto (w = larghezza X, h = altezza Y, d = profondità Z).
 * Coordinate locali: origine al centro dell'impronta, y = 0 a terra, fronte verso +Z.
 * Il modello sta sempre dentro il suo ingombro, che è quello usato per le collisioni.
 */

/** 'main' = colore dell'oggetto; 'dark' / 'light' = sue varianti; altrimenti un colore CSS */
export type PartColor = 'main' | 'dark' | 'light' | (string & {})

export interface Part {
  shape: 'box' | 'cyl' | 'sphere' | 'banana'
  /** centro della parte */
  p: [number, number, number]
  /** dimensioni (per cilindri e sfere: diametro X, altezza, diametro Z) */
  s: [number, number, number]
  c: PartColor
  /** rotazioni attorno agli assi (es. oblò rivolto in avanti) */
  rx?: number
  ry?: number
  rz?: number
  /** lati dei cilindri: 4 = piramide, 8 = ottagono */
  segments?: number
  /** rapporto raggio superiore / inferiore dei cilindri (tronco di cono) */
  taper?: number
  opacity?: number
}

type Builder = (w: number, h: number, d: number) => Part[]

const WOOD = '#7a5a40'
const METAL = '#9a9ea3'
const WHITE = '#f4f2ee'
const BLACK = '#2a2a2c'
const CERAMIC = '#f7f7f5'
const GLASS = '#a9d2ea'
const LINE = '#00000055'
const BARK = '#6b4a32'
const STONE = '#d8d2c4'

/** parallelepipedo dati gli spigoli minimo e massimo */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: PartColor, extra?: Partial<Part>): Part {
  return {
    shape: 'box',
    p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    s: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)],
    c,
    ...extra,
  }
}

function cyl(x: number, y0: number, z: number, dx: number, y1: number, dz: number, c: PartColor, extra?: Partial<Part>): Part {
  return { shape: 'cyl', p: [x, (y0 + y1) / 2, z], s: [dx, y1 - y0, dz], c, ...extra }
}

/** quattro gambe agli angoli, rientrate di `inset` */
function legs(w: number, d: number, y1: number, size: number, inset: number, c: PartColor): Part[] {
  const xs = [-w / 2 + inset, w / 2 - inset - size]
  const zs = [-d / 2 + inset, d / 2 - inset - size]
  return xs.flatMap((x) => zs.map((z) => box(x, 0, z, x + size, y1, z + size, c)))
}

/** linee verticali che dividono il fronte in ante, con maniglie */
function doors(w: number, y0: number, y1: number, zFront: number, count: number, withHandles = true): Part[] {
  const parts: Part[] = []
  const step = w / count
  for (let i = 1; i < count; i++) {
    const x = -w / 2 + i * step
    parts.push(box(x - 0.003, y0, zFront - 0.004, x + 0.003, y1, zFront, LINE))
  }
  if (withHandles) {
    for (let i = 0; i < count; i++) {
      // maniglia vicino al lato di apertura dell'anta
      const right = i % 2 === 0
      const x = -w / 2 + i * step + (right ? step - 0.05 : 0.05)
      const yc = Math.min(y1 - 0.1, Math.max(y0 + 0.1, (y0 + y1) / 2))
      parts.push(box(x - 0.008, yc - 0.08, zFront - 0.004, x + 0.008, yc + 0.08, zFront, METAL))
    }
  }
  return parts
}

/** cassetti sovrapposti con pomelli */
function drawers(w: number, y0: number, y1: number, zFront: number, count: number): Part[] {
  const parts: Part[] = []
  const step = (y1 - y0) / count
  for (let i = 0; i < count; i++) {
    const y = y0 + i * step
    if (i > 0) parts.push(box(-w / 2 + 0.01, y - 0.003, zFront - 0.004, w / 2 - 0.01, y + 0.003, zFront, LINE))
    parts.push(box(-0.06, y + step / 2 - 0.008, zFront - 0.004, 0.06, y + step / 2 + 0.008, zFront, METAL))
  }
  return parts
}

const B: Record<string, Builder> = {
  table: (w, h, d) => {
    const t = Math.min(0.04, h * 0.1)
    return [box(-w / 2, h - t, -d / 2, w / 2, h, d / 2, 'main'), ...legs(w, d, h - t, 0.05, 0.04, 'dark')]
  },

  roundTable: (w, h, d) => {
    const t = Math.min(0.04, h * 0.1)
    return [
      cyl(0, h - t, 0, w, h, d, 'main'),
      cyl(0, 0.03, 0, 0.08, h - t, 0.08, 'dark'),
      cyl(0, 0, 0, Math.min(w, d) * 0.5, 0.03, Math.min(w, d) * 0.5, 'dark'),
    ]
  },

  chair: (w, h, d) => {
    const seat = Math.min(0.46, h * 0.52)
    const t = 0.04
    return [
      box(-w / 2, seat - t, -d / 2, w / 2, seat, d / 2, 'main'),
      ...legs(w, d, seat - t, 0.035, 0.01, 'dark'),
      box(-w / 2, seat, -d / 2, w / 2, h, -d / 2 + 0.035, 'main'),
    ]
  },

  armchair: (w, h, d) => {
    const seat = Math.min(0.42, h * 0.5)
    const arm = Math.min(0.17, w * 0.2)
    const armH = Math.min(h, seat + 0.2)
    const back = Math.min(0.2, d * 0.25)
    return [
      box(-w / 2, 0.06, -d / 2, w / 2, seat - 0.08, d / 2, 'main'),
      box(-w / 2 + arm, seat - 0.08, -d / 2 + back, w / 2 - arm, seat, d / 2 - 0.02, 'light'),
      box(-w / 2, 0.06, -d / 2, w / 2, h, -d / 2 + back, 'main'),
      box(-w / 2, 0.06, -d / 2, -w / 2 + arm, armH, d / 2, 'main'),
      box(w / 2 - arm, 0.06, -d / 2, w / 2, armH, d / 2, 'main'),
      ...legs(w, d, 0.06, 0.04, 0.03, WOOD),
    ]
  },

  sofa: (w, h, d) => {
    const parts = B.armchair(w, h, d).filter((p) => p.c !== 'light')
    const seat = Math.min(0.42, h * 0.5)
    const arm = Math.min(0.17, w * 0.2)
    const back = Math.min(0.2, d * 0.25)
    const n = w - 2 * arm > 1.5 ? 3 : 2
    const cw = (w - 2 * arm) / n
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + arm + i * cw
      parts.push(box(x0 + 0.01, seat - 0.08, -d / 2 + back, x0 + cw - 0.01, seat, d / 2 - 0.02, 'light'))
      parts.push(box(x0 + 0.01, seat, -d / 2 + back, x0 + cw - 0.01, Math.min(h - 0.03, seat + 0.35), -d / 2 + back + 0.12, 'light'))
    }
    return parts
  },

  bed: (w, h, d) => {
    const frame = h * 0.33
    const mattress = h * 0.58
    const head = 0.07
    const pillows = w > 1.2 ? 2 : 1
    const pw = (w - 0.2) / pillows
    const parts: Part[] = [
      box(-w / 2, 0.05, -d / 2, w / 2, frame, d / 2, WOOD),
      box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + head, WOOD),
      ...legs(w, d, 0.05, 0.05, 0.02, WOOD),
      box(-w / 2 + 0.02, frame, -d / 2 + head, w / 2 - 0.02, mattress, d / 2 - 0.02, WHITE),
      // piumone (colore dell'oggetto) sui due terzi verso i piedi
      box(-w / 2 + 0.01, mattress - 0.12, -d / 2 + head + d * 0.3, w / 2 - 0.01, mattress + 0.03, d / 2 - 0.01, 'main'),
    ]
    for (let i = 0; i < pillows; i++) {
      const x0 = -w / 2 + 0.1 + i * pw
      parts.push(box(x0 + 0.03, mattress, -d / 2 + head + 0.04, x0 + pw - 0.03, Math.min(h, mattress + 0.1), -d / 2 + head + 0.4, WHITE))
    }
    return parts
  },

  wardrobe: (w, h, d) => [
    box(-w / 2, 0.08, -d / 2, w / 2, h, d / 2, 'main'),
    box(-w / 2 + 0.03, 0, -d / 2 + 0.03, w / 2 - 0.03, 0.08, d / 2 - 0.05, 'dark'),
    ...doors(w, 0.1, h - 0.02, d / 2 + 0.001, Math.max(1, Math.round(w / 0.5))),
  ],

  dresser: (w, h, d) => [
    box(-w / 2, 0.06, -d / 2, w / 2, h, d / 2, 'main'),
    ...legs(w, d, 0.06, 0.04, 0.03, 'dark'),
    ...drawers(w, 0.08, h - 0.02, d / 2 + 0.001, Math.max(2, Math.round((h - 0.1) / 0.22))),
  ],

  bookshelf: (w, h, d) => {
    const t = 0.025
    const parts: Part[] = [
      box(-w / 2, 0, -d / 2, -w / 2 + t, h, d / 2, 'main'),
      box(w / 2 - t, 0, -d / 2, w / 2, h, d / 2, 'main'),
      box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.01, 'dark'),
    ]
    const n = Math.max(2, Math.round(h / 0.36))
    for (let i = 0; i <= n; i++) {
      const y = Math.min(h - t, (i * (h - t)) / n)
      parts.push(box(-w / 2 + t, y, -d / 2, w / 2 - t, y + t, d / 2, 'main'))
      // qualche libro su ogni ripiano
      if (i < n) {
        const bh = Math.min(0.26, (h - t) / n - t - 0.04)
        const colors = ['#b5483a', '#3f6e9c', '#d2a84a', '#5c7d4e']
        for (let k = 0; k < 4; k++) {
          const x0 = -w / 2 + t + 0.03 + k * 0.05
          if (x0 + 0.04 > w / 2 - t) break
          parts.push(box(x0, y + t, -d / 2 + 0.03, x0 + 0.04, y + t + bh, d / 2 - 0.04, colors[(k + i) % 4]))
        }
      }
    }
    return parts
  },

  desk: (w, h, d) => {
    const t = 0.03
    return [
      box(-w / 2, h - t, -d / 2, w / 2, h, d / 2, 'main'),
      box(-w / 2, 0, -d / 2, -w / 2 + t, h - t, d / 2, 'dark'),
      box(w / 2 - t, 0, -d / 2, w / 2, h - t, d / 2, 'dark'),
      box(-w / 2 + t, h * 0.45, -d / 2 + 0.02, w / 2 - t, h - t, -d / 2 + 0.04, 'dark'),
    ]
  },

  coffeeTable: (w, h, d) => {
    const t = 0.03
    return [
      box(-w / 2, h - t, -d / 2, w / 2, h, d / 2, 'main'),
      box(-w / 2 + 0.05, 0.08, -d / 2 + 0.05, w / 2 - 0.05, 0.1, d / 2 - 0.05, 'dark'),
      ...legs(w, d, h - t, 0.04, 0.03, 'dark'),
    ]
  },

  tvStand: (w, h, d) => [
    box(-w / 2, 0.05, -d / 2, w / 2, h, d / 2, 'main'),
    ...legs(w, d, 0.05, 0.04, 0.04, BLACK),
    ...doors(w, 0.07, h - 0.02, d / 2 + 0.001, Math.max(2, Math.round(w / 0.6))),
  ],

  tv: (w, h, d) => [
    box(-w * 0.15, 0, -d / 2, w * 0.15, 0.02, d / 2, BLACK),
    box(-0.03, 0.02, -0.02, 0.03, 0.1, 0.02, BLACK),
    box(-w / 2, 0.08, -0.025, w / 2, h, 0.025, BLACK),
    box(-w / 2 + 0.01, 0.09, 0.025, w / 2 - 0.01, h - 0.01, 0.027, '#1c2733'),
  ],

  rug: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'main'),
    box(-w / 2 + 0.08, 0, -d / 2 + 0.08, w / 2 - 0.08, h + 0.001, d / 2 - 0.08, 'light'),
  ],

  plant: (w, h, d) => {
    const pot = Math.min(0.35, h * 0.3)
    const leaves = Math.min(w, d)
    return [
      cyl(0, 0, 0, Math.min(w, d) * 0.55, pot, Math.min(w, d) * 0.55, '#b5653a', { taper: 1.25 }),
      { shape: 'sphere', p: [0, h - (h - pot) / 2, 0], s: [leaves, h - pot, leaves], c: 'main' },
    ]
  },

  floorLamp: (w, h, d) => {
    const shade = Math.min(0.35, h * 0.22)
    return [
      cyl(0, 0, 0, w * 0.7, 0.03, d * 0.7, BLACK),
      cyl(0, 0.03, 0, 0.025, h - shade, 0.025, METAL),
      cyl(0, h - shade, 0, w, h, d, 'main', { taper: 0.6, opacity: 0.9 }),
    ]
  },

  nightstand: (w, h, d) => [
    box(-w / 2, 0.08, -d / 2, w / 2, h, d / 2, 'main'),
    ...legs(w, d, 0.08, 0.035, 0.02, 'dark'),
    ...drawers(w, 0.1, h - 0.02, d / 2 + 0.001, 2),
  ],

  kitchen: (w, h, d) => {
    const top = 0.04
    const parts: Part[] = [
      box(-w / 2, 0, -d / 2, w / 2, 0.1, d / 2 - 0.06, BLACK),
      box(-w / 2, 0.1, -d / 2, w / 2, h - top, d / 2 - 0.01, WHITE),
      box(-w / 2, h - top, -d / 2, w / 2, h, d / 2, 'main'),
      ...doors(w, 0.12, h - top - 0.02, d / 2 - 0.009, Math.max(1, Math.round(w / 0.6))),
    ]
    if (w >= 1.2) {
      // lavello e piano cottura
      parts.push(box(-w / 2 + 0.15, h - 0.01, -d / 2 + 0.1, -w / 2 + 0.65, h + 0.002, d / 2 - 0.1, METAL))
      parts.push(cyl(-w / 2 + 0.4, h, -d / 2 + 0.06, 0.03, h + 0.002, 0.03, METAL))
      parts.push(box(w / 2 - 0.75, h - 0.005, -d / 2 + 0.06, w / 2 - 0.15, h + 0.002, d / 2 - 0.06, BLACK))
    }
    return parts
  },

  fridge: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, h, d / 2 - 0.01, 'main'),
    box(-w / 2 + 0.01, h * 0.62, d / 2 - 0.012, w / 2 - 0.01, h * 0.62 + 0.006, d / 2, LINE),
    box(w / 2 - 0.06, h * 0.66, d / 2 - 0.01, w / 2 - 0.04, h * 0.66 + 0.25, d / 2, METAL),
    box(w / 2 - 0.06, h * 0.58 - 0.25, d / 2 - 0.01, w / 2 - 0.04, h * 0.58, d / 2, METAL),
  ],

  washer: (w, h, d) => {
    const door = Math.min(w, h) * 0.6
    return [
      box(-w / 2, 0, -d / 2, w / 2, h, d / 2 - 0.01, 'main'),
      box(-w / 2 + 0.02, h - 0.12, d / 2 - 0.012, w / 2 - 0.02, h - 0.02, d / 2, '#d8d8d8'),
      { shape: 'cyl', p: [0, h * 0.45, d / 2 - 0.004], s: [door, 0.012, door], c: METAL, rx: Math.PI / 2 },
      { shape: 'cyl', p: [0, h * 0.45, d / 2 - 0.002], s: [door * 0.75, 0.012, door * 0.75], c: '#3d4a57', rx: Math.PI / 2 },
    ]
  },

  toilet: (w, h, d) => {
    const tank = Math.min(0.2, d * 0.3)
    const seat = Math.min(0.42, h * 0.55)
    return [
      box(-w / 2, seat - 0.05, -d / 2, w / 2, h, -d / 2 + tank, 'main'),
      cyl(0, 0, -d / 2 + tank + (d - tank) / 2 - 0.02, w * 0.6, seat - 0.05, (d - tank) * 0.7, 'main'),
      cyl(0, seat - 0.05, -d / 2 + tank + (d - tank) / 2, w, seat, d - tank, 'main'),
      cyl(0, seat - 0.01, -d / 2 + tank + (d - tank) / 2, w * 0.6, seat + 0.001, (d - tank) * 0.6, '#d9dcdf'),
    ]
  },

  washbasin: (w, h, d) => {
    // il rubinetto (ultimi 12 cm) è compreso nell'altezza
    const top = h - 0.12
    return [
      box(-w / 2, 0.1, -d / 2, w / 2, top - 0.12, d / 2, 'main'),
      box(-w / 2, top - 0.12, -d / 2, w / 2, top, d / 2, CERAMIC),
      box(-w / 2 + 0.07, top - 0.04, -d / 2 + 0.12, w / 2 - 0.07, top + 0.001, d / 2 - 0.05, '#d9dcdf'),
      cyl(0, top, -d / 2 + 0.06, 0.03, h, 0.03, METAL),
      ...doors(w, 0.12, top - 0.14, d / 2 + 0.001, 2),
    ]
  },

  bathtub: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'main'),
    box(-w / 2 + 0.08, h * 0.35, -d / 2 + 0.08, w / 2 - 0.08, h + 0.002, d / 2 - 0.08, '#dde5ea'),
  ],

  shower: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, 0.05, d / 2, CERAMIC),
    box(-w / 2, 0.05, d / 2 - 0.01, w / 2, h, d / 2, GLASS, { opacity: 0.35 }),
    box(w / 2 - 0.01, 0.05, -d / 2, w / 2, h, d / 2, GLASS, { opacity: 0.35 }),
    cyl(-w / 2 + 0.1, 0.05, -d / 2 + 0.1, 0.02, h - 0.1, 0.02, METAL),
    cyl(-w / 2 + 0.2, h - 0.12, -d / 2 + 0.2, 0.2, h - 0.1, 0.2, METAL),
  ],

  pallet: (w, h, d) => {
    const board = h * 0.15
    const block = 0.1
    const parts: Part[] = []
    const zs = [-d / 2, -block / 2, d / 2 - block]
    for (const z of zs) {
      parts.push(box(-w / 2, 0, z, w / 2, board, z + block, 'dark'))
      for (const x of [-w / 2, -0.07, w / 2 - 0.14]) parts.push(box(x, board, z, x + 0.14, h - board, z + block, 'main'))
    }
    const slats = 5
    const sw = (d - 0.02) / slats - 0.03
    for (let i = 0; i < slats; i++) {
      const z0 = -d / 2 + i * ((d - sw) / (slats - 1))
      parts.push(box(-w / 2, h - board, z0, w / 2, h, z0 + sw, 'light'))
    }
    return parts
  },

  carton: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'main'),
    box(-w / 2 - 0.001, h - 0.001, -0.025, w / 2 + 0.001, h + 0.001, 0.025, '#e2cfa3'),
    box(-w / 2 + 0.002, h - 0.002, -d / 2, w / 2 - 0.002, h + 0.0005, -d / 2 + 0.002, LINE),
  ],

  // ------------------------------------------------------------- giardino

  tree: (w, h, d) => {
    const trunk = h * 0.42
    return [
      cyl(0, 0, 0, Math.min(w, d) * 0.12, trunk + h * 0.1, Math.min(w, d) * 0.12, BARK, { taper: 0.75 }),
      { shape: 'sphere', p: [0, trunk + (h - trunk) * 0.5, 0], s: [w, h - trunk, d], c: 'main' },
      { shape: 'sphere', p: [w * 0.18, trunk + (h - trunk) * 0.62, -d * 0.12], s: [w * 0.6, (h - trunk) * 0.6, d * 0.6], c: 'light' },
    ]
  },

  pine: (w, h, d) => {
    const trunk = h * 0.15
    const parts: Part[] = [cyl(0, 0, 0, w * 0.1, trunk + 0.2, d * 0.1, BARK)]
    // tre coni sovrapposti, sempre più piccoli verso la cima
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.25
      const y0 = trunk + i * (h - trunk) * 0.24
      parts.push(cyl(0, y0, 0, w * k, Math.min(h, y0 + (h - trunk) * 0.52), d * k, i === 1 ? 'light' : 'main', { taper: 0 }))
    }
    return parts
  },

  bush: (w, h, d) => [
    { shape: 'sphere', p: [-w * 0.18, h * 0.42, 0], s: [w * 0.64, h * 0.84, d * 0.8], c: 'main' },
    { shape: 'sphere', p: [w * 0.2, h * 0.38, d * 0.08], s: [w * 0.6, h * 0.76, d * 0.75], c: 'dark' },
    { shape: 'sphere', p: [0, h * 0.55, -d * 0.1], s: [w * 0.6, h * 0.9, d * 0.7], c: 'light' },
  ],

  hedge: (w, h, d) => [
    box(-w / 2, 0, -d / 2, w / 2, h - 0.05, d / 2, 'main'),
    box(-w / 2 + 0.03, h - 0.05, -d / 2 + 0.03, w / 2 - 0.03, h, d / 2 - 0.03, 'light'),
  ],

  pool: (w, h, d) => {
    const rim = Math.min(0.3, Math.min(w, d) * 0.08)
    return [
      // bordo in pietra; acqua più bassa del bordo
      box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + rim, STONE),
      box(-w / 2, 0, d / 2 - rim, w / 2, h, d / 2, STONE),
      box(-w / 2, 0, -d / 2 + rim, -w / 2 + rim, h, d / 2 - rim, STONE),
      box(w / 2 - rim, 0, -d / 2 + rim, w / 2, h, d / 2 - rim, STONE),
      box(-w / 2 + rim, 0, -d / 2 + rim, w / 2 - rim, h * 0.6, d / 2 - rim, 'main', { opacity: 0.85 }),
      // scaletta
      box(w / 2 - rim - 0.06, h * 0.6, -0.25, w / 2 - rim - 0.02, h, -0.21, METAL),
      box(w / 2 - rim - 0.06, h * 0.6, 0.21, w / 2 - rim - 0.02, h, 0.25, METAL),
    ]
  },

  gazebo: (w, h, d) => {
    const roof = Math.min(1, h * 0.32)
    const eave = h - roof
    return [
      box(-w * 0.45, 0, -d * 0.45, w * 0.45, 0.04, d * 0.45, STONE),
      ...legs(w - 0.1, d - 0.1, eave, 0.1, 0, WOOD),
      box(-w / 2 + 0.05, eave - 0.15, -d / 2 + 0.05, w / 2 - 0.05, eave, d / 2 - 0.05, WOOD),
      // tetto a piramide: cilindro a 4 lati ruotato di 45° (diagonale = lato × √2)
      { shape: 'cyl', p: [0, eave + roof / 2, 0], s: [w * Math.SQRT2, roof, d * Math.SQRT2], c: 'main', taper: 0, segments: 4, ry: Math.PI / 4 },
    ]
  },

  parasol: (w, h, d) => {
    const canopy = Math.min(0.5, h * 0.22)
    return [
      cyl(0, 0, 0, 0.45, 0.06, 0.45, STONE),
      cyl(0, 0.06, 0, 0.04, h - 0.05, 0.04, WOOD),
      cyl(0, h - canopy, 0, w, h - 0.03, d, 'main', { taper: 0.04, segments: 8 }),
      cyl(0, h - 0.05, 0, 0.06, h, 0.06, WOOD),
    ]
  },

  lounger: (w, h, d) => {
    const seat = Math.min(0.35, h * 0.4)
    const back = d * 0.32
    const zHinge = -d / 2 + back
    // schienale inclinato, incernierato a fine seduta verso la testa (−Z)
    const backLen = Math.hypot(back, h - seat)
    const angle = Math.atan2(h - seat, back)
    return [
      ...legs(w, d, seat - 0.05, 0.04, 0.03, METAL),
      box(-w / 2, seat - 0.05, zHinge, w / 2, seat, d / 2, WHITE),
      box(-w / 2 + 0.03, seat, zHinge, w / 2 - 0.03, seat + 0.06, d / 2 - 0.02, 'main'),
      { shape: 'box', p: [0, seat + (h - seat) / 2, zHinge - back / 2], s: [w - 0.06, 0.06, backLen], c: 'main', rx: angle },
    ]
  },

  bench: (w, h, d) => {
    const seat = Math.min(0.45, h * 0.55)
    const parts: Part[] = [
      box(-w / 2 + 0.05, 0, -d / 2, -w / 2 + 0.11, seat, d / 2, METAL),
      box(w / 2 - 0.11, 0, -d / 2, w / 2 - 0.05, seat, d / 2, METAL),
      box(-w / 2 + 0.05, seat, -d / 2, -w / 2 + 0.11, h, -d / 2 + 0.06, METAL),
      box(w / 2 - 0.11, seat, -d / 2, w / 2 - 0.05, h, -d / 2 + 0.06, METAL),
    ]
    const slats = 4
    const sw = (d - 0.04) / slats
    for (let i = 0; i < slats; i++) {
      const z0 = -d / 2 + 0.02 + i * sw
      parts.push(box(-w / 2, seat - 0.04, z0, w / 2, seat, z0 + sw - 0.02, 'main'))
    }
    for (let i = 0; i < 2; i++) {
      const y = seat + 0.12 + i * 0.16
      parts.push(box(-w / 2, y, -d / 2, w / 2, Math.min(h, y + 0.1), -d / 2 + 0.03, 'main'))
    }
    return parts
  },

  bbq: (w, h, d) => {
    const bowl = Math.min(w, d)
    const top = h - bowl * 0.5
    return [
      ...legs(w * 0.7, d * 0.7, top, 0.03, 0, METAL),
      cyl(0, top * 0.35, 0, w * 0.6, top * 0.35 + 0.02, d * 0.6, METAL),
      { shape: 'sphere', p: [0, top, 0], s: [bowl, bowl, bowl], c: 'main' },
      cyl(0, top + bowl / 2 - 0.01, 0, 0.06, h, 0.06, METAL),
    ]
  },

  // animali: corpo lungo X, muso verso +X

  dog: (w, h, d) => {
    const leg = h * 0.45
    const bodyH = h * 0.32
    const bodyY = leg + bodyH / 2 - 0.02
    const legW = Math.min(d * 0.28, 0.07)
    const parts: Part[] = [
      { shape: 'sphere', p: [-w * 0.06, bodyY, 0], s: [w * 0.62, bodyH, d * 0.8], c: 'main' },
      { shape: 'sphere', p: [w * 0.3, h * 0.8, 0], s: [w * 0.26, h * 0.32, d * 0.62], c: 'main' },
      { shape: 'sphere', p: [w * 0.42, h * 0.74, 0], s: [w * 0.14, h * 0.15, d * 0.34], c: 'light' },
      { shape: 'sphere', p: [w * 0.49, h * 0.76, 0], s: [w * 0.04, h * 0.05, d * 0.12], c: BLACK },
      // orecchie pendenti
      { shape: 'sphere', p: [w * 0.27, h * 0.8, d * 0.33], s: [w * 0.08, h * 0.24, d * 0.12], c: 'dark' },
      { shape: 'sphere', p: [w * 0.27, h * 0.8, -d * 0.33], s: [w * 0.08, h * 0.24, d * 0.12], c: 'dark' },
      // coda
      { shape: 'cyl', p: [-w * 0.4, bodyY + h * 0.1, 0], s: [0.035, w * 0.22, 0.035], c: 'main', rz: 0.9 },
    ]
    for (const x of [w * 0.15, -w * 0.25]) for (const z of [d * 0.25, -d * 0.25]) parts.push(cyl(x, 0, z, legW, leg + 0.02, legW, 'main'))
    return parts
  },

  cat: (w, h, d) => {
    const leg = h * 0.38
    const bodyH = h * 0.36
    const bodyY = leg + bodyH / 2 - 0.01
    const parts: Part[] = [
      { shape: 'sphere', p: [-w * 0.05, bodyY, 0], s: [w * 0.55, bodyH, d * 0.8], c: 'main' },
      { shape: 'sphere', p: [w * 0.28, h * 0.7, 0], s: [w * 0.22, h * 0.3, d * 0.75], c: 'main' },
      // orecchie a punta
      cyl(w * 0.28, h * 0.8, d * 0.2, w * 0.07, h, d * 0.25, 'dark', { taper: 0 }),
      cyl(w * 0.28, h * 0.8, -d * 0.2, w * 0.07, h, d * 0.25, 'dark', { taper: 0 }),
      { shape: 'sphere', p: [w * 0.39, h * 0.68, 0], s: [w * 0.03, h * 0.04, d * 0.12], c: '#e8908f' },
      // coda alzata
      { shape: 'cyl', p: [-w * 0.36, bodyY + h * 0.2, 0], s: [0.025, h * 0.55, 0.025], c: 'main', rz: 0.35 },
    ]
    for (const x of [w * 0.12, -w * 0.22]) for (const z of [d * 0.22, -d * 0.22]) parts.push(cyl(x, 0, z, 0.03, leg + 0.02, 0.03, 'main'))
    return parts
  },

  pigeon: (w, h, d) => {
    const leg = h * 0.18
    return [
      { shape: 'sphere', p: [-w * 0.02, leg + h * 0.25, 0], s: [w * 0.62, h * 0.5, d * 0.85], c: 'main' },
      { shape: 'sphere', p: [w * 0.17, leg + h * 0.38, 0], s: [w * 0.3, h * 0.34, d * 0.62], c: '#7e8f86' },
      { shape: 'sphere', p: [w * 0.27, h * 0.82, 0], s: [w * 0.22, h * 0.3, d * 0.5], c: 'dark' },
      { shape: 'cyl', p: [w * 0.42, h * 0.8, 0], s: [0.014, w * 0.1, 0.014], c: '#d9a066', taper: 0, rz: -Math.PI / 2 },
      { shape: 'sphere', p: [w * 0.33, h * 0.86, d * 0.16], s: [0.012, 0.012, 0.012], c: '#f08a24' },
      { shape: 'sphere', p: [w * 0.33, h * 0.86, -d * 0.16], s: [0.012, 0.012, 0.012], c: '#f08a24' },
      // coda
      box(-w / 2, leg + h * 0.14, -d * 0.22, -w * 0.2, leg + h * 0.22, d * 0.22, 'dark', { rz: -0.25 }),
      cyl(0.02, 0, 0.025, 0.008, leg + 0.01, 0.008, '#c9615a'),
      cyl(0.02, 0, -0.025, 0.008, leg + 0.01, 0.008, '#c9615a'),
    ]
  },

  banana: (w, h, d) => [{ shape: 'banana', p: [0, h / 2, 0], s: [w, h, d], c: 'main' }],
}

export function buildModel(model: string, w: number, h: number, d: number): Part[] | null {
  const b = B[model]
  return b ? b(w, h, d) : null
}

export const MODEL_NAMES = Object.keys(B)
