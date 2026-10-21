import { describe, expect, it } from 'vitest'
import { compileSculpt } from './compile'
import { pickSculpt } from './pick'
import { emptySculptDoc, newSculptNode } from '../model/sculpt'

describe('selezione col raggio', () => {
  const a = newSculptNode('sphere', { position: [0, 0, 0], size: [0.2, 0.2, 0.2], blend: 0 })
  const b = newSculptNode('box', { position: [0.5, 0, 0], size: [0.2, 0.2, 0.2], blend: 0 })
  const cut = newSculptNode('sphere', { op: 'subtract', position: [0, 0, 0.1], size: [0.1, 0.1, 0.1], blend: 0 })
  const c = compileSculpt({ ...emptySculptDoc(), nodes: [a, b, cut] })

  it('colpisce la forma giusta e restituisce il punto sulla superficie', () => {
    const hit = pickSculpt(c, [0.5, 0, 2], [0, 0, -1])!
    expect(hit.nodeId).toBe(b.id)
    expect(hit.point[2]).toBeCloseTo(0.1, 3)
  })

  it('sulla superficie scavata seleziona la forma che scava', () => {
    const hit = pickSculpt(c, [0, 0, 2], [0, 0, -1])!
    expect(hit.nodeId).toBe(cut.id)
    // il raggio entra nella cavità e tocca il fondo, oltre la superficie originale della sfera
    expect(hit.point[2]).toBeLessThan(0.06)
  })

  it('un raggio che non incontra nulla non seleziona niente', () => {
    expect(pickSculpt(c, [0, 1, 2], [0, 0, -1])).toBeNull()
  })
})
