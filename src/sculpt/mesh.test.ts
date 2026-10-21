import { describe, expect, it } from 'vitest'
import { compileSculpt, evaluateSculpt } from './compile'
import { distanceFunction, meshSculpt, nonManifoldEdges, QUALITY, type SculptMesh } from './mesh'
import { emptySculptDoc, newSculptNode, type SculptNode } from '../model/sculpt'
import { sampleSculpt } from '../model/factory'

const compiled = (nodes: SculptNode[]) => compileSculpt({ ...emptySculptDoc(), nodes })

/** Ogni spigolo condiviso da esattamente due triangoli, con versi opposti: mesh chiusa e orientata */
function isClosedManifold(m: SculptMesh) {
  const edges = new Map<string, number>()
  const tri = m.indices
  for (let t = 0; t < tri.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = tri[t + e]
      const b = tri[t + ((e + 1) % 3)]
      const key = `${a}>${b}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  for (const [key, n] of edges) {
    const [a, b] = key.split('>')
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false
  }
  return true
}

/** Volume con segno (teorema della divergenza): positivo se le facce guardano fuori */
function signedVolume(m: SculptMesh) {
  const p = m.positions
  let v = 0
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3]
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])
  }
  return v / 6
}

describe('estrazione della mesh', () => {
  it('la distanza veloce coincide con la valutazione completa', () => {
    const c = compileSculpt(sampleSculpt())
    const f = distanceFunction(c)
    for (const p of [[0, 0.05, 0], [0.1, 0.13, 0], [0.2, 0.3, -0.1], [-0.03, 0.24, 0.05]] as [number, number, number][]) {
      expect(f(...p)).toBeCloseTo(evaluateSculpt(c, p).d, 9)
    }
  })

  it('una sfera diventa una mesh chiusa, orientata verso l’esterno, con il volume giusto', () => {
    const m = meshSculpt(compiled([newSculptNode('sphere', { position: [0, 0, 0], size: [0.2, 0.2, 0.2] })]), 48)!
    expect(m.indices.length % 3).toBe(0)
    expect(isClosedManifold(m)).toBe(true)
    const volume = signedVolume(m)
    expect(volume).toBeGreaterThan(0)
    // 4/3 π r³ con r = 0.1, entro il 3%
    expect(volume).toBeCloseTo((4 / 3) * Math.PI * 0.001, 4)
    // i vertici stanno sulla superficie
    for (let i = 0; i < m.positions.length; i += 3) {
      expect(Math.hypot(m.positions[i], m.positions[i + 1], m.positions[i + 2])).toBeCloseTo(0.1, 3)
    }
  })

  it('il fungo di esempio è chiuso e colorato alla qualità minima', () => {
    // sotto ~80 celle il bordo sottile del cappello (circa una cella) può chiudersi male
    const m = meshSculpt(compileSculpt(sampleSculpt()), QUALITY.draft)!
    expect(isClosedManifold(m)).toBe(true)
    expect(nonManifoldEdges(m)).toBe(0)
    expect(signedVolume(m)).toBeGreaterThan(0)
    expect(m.colors.length).toBe(m.positions.length)
    // c'è sia il rosso del cappello sia il crema del gambo
    let red = 0
    for (let i = 0; i < m.colors.length; i += 3) if (m.colors[i] > 0.5 && m.colors[i + 1] < 0.2) red++
    expect(red).toBeGreaterThan(0)
  })

  it('a risoluzione troppo bassa i punti critici vengono segnalati', () => {
    expect(nonManifoldEdges(meshSculpt(compileSculpt(sampleSculpt()), 40)!)).toBeGreaterThan(0)
  })

  it('un modello vuoto non ha mesh', () => {
    expect(meshSculpt(compiled([]), 32)).toBeNull()
  })
})
