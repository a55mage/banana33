import { describe, expect, it } from 'vitest'
import { compileSculpt, evaluateSculpt, sculptGLSL, sculptUniforms } from './compile'
import { emptySculptDoc, newSculptNode, type SculptDoc, type SculptNode } from '../model/sculpt'
import { sampleSculpt } from '../model/factory'

const doc = (nodes: SculptNode[], patch: Partial<SculptDoc> = {}): SculptDoc => ({ ...emptySculptDoc(), nodes, ...patch })
const ball = (patch: Partial<SculptNode> = {}) => newSculptNode('sphere', { position: [0, 0, 0], size: [0.2, 0.2, 0.2], blend: 0, ...patch })

describe('compilazione del modello', () => {
  it('una sfera traslata: distanza esatta nel mondo', () => {
    const c = compileSculpt(doc([ball({ position: [1, 0, 0] })]))
    expect(evaluateSculpt(c, [1.1, 0, 0]).d).toBeCloseTo(0, 6)
    expect(evaluateSculpt(c, [1, 0, 0]).d).toBeCloseTo(-0.1, 6)
    expect(c.bounds!.min[0]).toBeCloseTo(0.9)
    expect(c.bounds!.max[0]).toBeCloseTo(1.1)
  })

  it('la rotazione segue la convenzione YXZ: un cubo lungo X ruotato di 90° su Y si allunga su Z', () => {
    const c = compileSculpt(doc([newSculptNode('box', { position: [0, 0, 0], size: [0.4, 0.1, 0.1], rotation: [0, 90, 0] })]))
    expect(evaluateSculpt(c, [0, 0, 0.2]).d).toBeCloseTo(0, 6)
    expect(evaluateSculpt(c, [0.2, 0, 0]).d).toBeGreaterThan(0.1)
  })

  it('la sottrazione scava e non allarga l’ingombro', () => {
    const c = compileSculpt(doc([ball(), ball({ op: 'subtract', position: [0.1, 0, 0], size: [0.1, 0.1, 0.1] })]))
    expect(evaluateSculpt(c, [0.08, 0, 0]).d).toBeGreaterThan(0)
    expect(evaluateSculpt(c, [-0.05, 0, 0]).d).toBeLessThan(0)
    expect(c.bounds!.max[0]).toBeCloseTo(0.1)
  })

  it('un gruppo scalato scala anche le distanze', () => {
    const g = newSculptNode('group', { position: [0, 0, 0], size: [2, 2, 2] })
    const c = compileSculpt(doc([g, ball({ parentId: g.id })]))
    // sfera di diametro 0.2 nel gruppo ×2 → raggio 0.2 nel mondo
    expect(evaluateSculpt(c, [0.2, 0, 0]).d).toBeCloseTo(0, 6)
    expect(evaluateSculpt(c, [0.5, 0, 0]).d).toBeCloseTo(0.3, 6)
  })

  it('i nodi nascosti non esistono; la chiave cambia con la struttura, non con i valori', () => {
    const a = ball()
    const b = ball({ position: [0.5, 0, 0] })
    const c1 = compileSculpt(doc([a, b]))
    const c2 = compileSculpt(doc([a, { ...b, position: [0.6, 0, 0], color: '#000000' }]))
    const c3 = compileSculpt(doc([a, { ...b, op: 'subtract' }]))
    const c4 = compileSculpt(doc([a, { ...b, hidden: true }]))
    expect(c2.key).toBe(c1.key)
    expect(c3.key).not.toBe(c1.key)
    expect(c4.count).toBe(1)
    expect(evaluateSculpt(c4, [0.5, 0, 0]).d).toBeGreaterThan(0.2)
  })

  it('la simmetria su X specchia la metà positiva', () => {
    const c = compileSculpt(doc([ball({ position: [0.3, 0, 0] })], { symmetry: { x: true, y: false, z: false } }))
    expect(evaluateSculpt(c, [-0.3, 0, 0]).d).toBeCloseTo(-0.1, 6)
    expect(c.bounds!.min[0]).toBeCloseTo(-0.4)
  })

  it('il fungo di esempio: solido sotto il cappello, vuoto sotto il sottocappello', () => {
    const c = compileSculpt(sampleSculpt())
    expect(evaluateSculpt(c, [0, 0.05, 0]).d).toBeLessThan(0) // gambo
    expect(evaluateSculpt(c, [0, 0.13, 0]).d).toBeLessThan(0) // il gambo arriva fino al cappello
    expect(evaluateSculpt(c, [0, 0.21, 0]).d).toBeLessThan(0) // cappello
    expect(evaluateSculpt(c, [0.1, 0.13, 0]).d).toBeGreaterThan(0) // scavato dal sottocappello
    expect(c.bounds!.min[1]).toBeLessThanOrEqual(0)
  })

  it('genera GLSL con un blocco per nodo e uniform della giusta dimensione', () => {
    const c = compileSculpt(sampleSculpt())
    const glsl = sculptGLSL(c)
    expect(glsl).toContain('float sceneMap(vec3 p, out vec3 col, out vec4 mat)')
    expect(glsl.match(/uInv\[\d+\] \* vec4/g)).toHaveLength(c.count - 1) // il gruppo non ha forma
    expect(glsl).toContain('opSubtract')
    const u = sculptUniforms(c)
    expect(u.count).toBe(c.count)
    expect(u.inv[0].elements[3]).toBe(1) // fattore di distanza nella riga libera
  })

  it('lo specchio duplica la forma dall’altra parte, da qualunque lato si trovi', () => {
    const c = compileSculpt(doc([ball({ position: [-0.3, 0, 0], mirror: { x: true, y: false, z: false } })]))
    expect(evaluateSculpt(c, [-0.3, 0, 0]).d).toBeCloseTo(-0.1, 6)
    expect(evaluateSculpt(c, [0.3, 0, 0]).d).toBeCloseTo(-0.1, 6)
    expect(c.bounds!.max[0]).toBeCloseTo(0.4)
    // le copie specchiate sono codice dello shader: cambiano la chiave
    const plain = compileSculpt(doc([ball({ position: [-0.3, 0, 0] })]))
    expect(plain.key).not.toBe(c.key)
  })

  it('il guscio svuota la forma lasciando una parete', () => {
    const c = compileSculpt(doc([ball({ shell: 0.02 })]))
    expect(evaluateSculpt(c, [0.095, 0, 0]).d).toBeLessThan(0) // nella parete
    expect(evaluateSculpt(c, [0, 0, 0]).d).toBeGreaterThan(0) // vuoto al centro
  })

  it('ogni forma ha la sua finitura; senza, vale quella del modello', () => {
    const c = compileSculpt(doc([ball({ material: 'metal' }), ball({ position: [0.5, 0, 0] })], { material: 'clay' }))
    expect(evaluateSculpt(c, [0, 0, 0]).m[2]).toBe(1) // metallo
    expect(evaluateSculpt(c, [0.5, 0, 0]).m[3]).toBe(1) // argilla dal modello
  })

  it('un modello vuoto non ha ingombro', () => {
    expect(compileSculpt(emptySculptDoc()).bounds).toBeNull()
  })
})
