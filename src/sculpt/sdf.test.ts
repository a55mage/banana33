import { describe, expect, it } from 'vitest'
import { MATERIAL_PARAMS, opIntersect, opShell, opSubtract, opUnion, sdShape, type ShapeKind, type V3 } from './sdf'

const S: V3 = [0.2, 0.2, 0.2]
const at = (kind: ShapeKind, p: V3, s: V3 = S, r = 0) => sdShape(kind, p, s, r)

describe('forme SDF', () => {
  it('sfera: zero sulla superficie, negativa dentro, distanza esatta fuori', () => {
    expect(at('sphere', [0.1, 0, 0])).toBeCloseTo(0, 6)
    expect(at('sphere', [0, 0, 0])).toBeCloseTo(-0.1, 6)
    expect(at('sphere', [0, 0.3, 0])).toBeCloseTo(0.2, 6)
  })

  it('ellissoide: zero alle estremità dei semiassi', () => {
    const s: V3 = [0.4, 0.2, 0.1]
    for (const p of [[0.2, 0, 0], [0, 0.1, 0], [0, 0, 0.05]] as V3[]) expect(at('sphere', p, s)).toBeCloseTo(0, 5)
  })

  it('cubo: facce, spigoli e arrotondamento', () => {
    expect(at('box', [0.1, 0, 0])).toBeCloseTo(0, 6)
    expect(at('box', [0, 0, 0])).toBeCloseTo(-0.1, 6)
    // vertice: fuori dal cubo vivo di 0, dal cubo arrotondato di r·(√3 − 1)
    expect(at('box', [0.1, 0.1, 0.1])).toBeCloseTo(0, 6)
    expect(at('box', [0.1, 0.1, 0.1], S, 0.02)).toBeCloseTo(0.02 * (Math.sqrt(3) - 1), 5)
    // le facce restano al loro posto anche arrotondando
    expect(at('box', [0.1, 0, 0], S, 0.02)).toBeCloseTo(0, 6)
  })

  it('cilindro: fianco, basi e centro', () => {
    const s: V3 = [0.16, 0.2, 0.16]
    expect(at('cylinder', [0.08, 0, 0], s)).toBeCloseTo(0, 6)
    expect(at('cylinder', [0, 0.1, 0], s)).toBeCloseTo(0, 6)
    expect(at('cylinder', [0, 0, 0], s)).toBeCloseTo(-0.08, 6)
  })

  it('cono: punta in alto, base in basso', () => {
    const s: V3 = [0.2, 0.24, 0.2]
    expect(at('cone', [0, 0.12, 0], s)).toBeCloseTo(0, 6)
    expect(at('cone', [0, -0.12, 0], s)).toBeCloseTo(0, 6)
    expect(at('cone', [0.1, -0.12, 0], s)).toBeCloseTo(0, 6)
    expect(at('cone', [0, 0, 0], s)).toBeLessThan(0)
    expect(at('cone', [0.1, 0.1, 0], s)).toBeGreaterThan(0)
  })

  it('toro: anello sul piano XZ', () => {
    const s: V3 = [0.24, 0.06, 0.24]
    expect(at('torus', [0.12, 0, 0], s)).toBeCloseTo(0, 6) // bordo esterno
    expect(at('torus', [0.06, 0, 0], s)).toBeCloseTo(0, 6) // bordo interno
    expect(at('torus', [0, 0, 0], s)).toBeCloseTo(0.06, 6) // centro vuoto
  })

  it('capsula: estremità sferiche', () => {
    const s: V3 = [0.1, 0.24, 0.1]
    expect(at('capsule', [0, 0.12, 0], s)).toBeCloseTo(0, 6)
    expect(at('capsule', [0.05, 0, 0], s)).toBeCloseTo(0, 6)
  })
})

describe('operazioni', () => {
  const red = [1, 0, 0] as [number, number, number]
  const blue = [0, 0, 1] as [number, number, number]
  const m = MATERIAL_PARAMS.glossy

  it('senza fusione sono min, max(a, −b) e max', () => {
    const a = { d: 0.3, c: red, m }
    const b = { d: -0.1, c: blue, m }
    expect(opUnion(a, b, 0).d).toBeCloseTo(-0.1)
    expect(opSubtract(a, b, 0).d).toBeCloseTo(0.3)
    expect(opIntersect(a, b, 0).d).toBeCloseTo(0.3)
    expect(opUnion(a, b, 0).c).toEqual(blue)
  })

  it('la fusione morbida "gonfia" l’unione e mescola i colori', () => {
    const a = { d: 0.01, c: red, m: MATERIAL_PARAMS.matte }
    const b = { d: 0.01, c: blue, m: MATERIAL_PARAMS.metal }
    const u = opUnion(a, b, 0.05)
    expect(u.d).toBeLessThan(0.01)
    expect(u.c[0]).toBeCloseTo(0.5)
    expect(u.c[2]).toBeCloseTo(0.5)
    // anche la finitura si mescola: metà opaco, metà metallo
    expect(u.m[2]).toBeCloseTo(0.5)
  })

  it('il guscio lascia la superficie esterna e svuota l’interno', () => {
    expect(opShell(0, 0.02)).toBeCloseTo(0) // superficie esterna
    expect(opShell(-0.01, 0.02)).toBeCloseTo(-0.01) // dentro la parete
    expect(opShell(-0.05, 0.02)).toBeCloseTo(0.03) // nel vuoto interno
    expect(opShell(-0.05, 0)).toBe(-0.05) // senza guscio resta pieno
  })

  it('la sottrazione scava: un punto dentro entrambe le forme è fuori', () => {
    expect(opSubtract({ d: -0.05, c: red, m }, { d: -0.02, c: blue, m }, 0).d).toBeGreaterThan(0)
  })
})
