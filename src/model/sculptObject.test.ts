import { describe, expect, it } from 'vitest'
import { newProject, objectFromSculpt, PRIMITIVES, newObject, sampleSculpt } from './factory'
import { parseProject } from './schema'
import { emptySculptDoc } from './sculpt'
import { compileSculpt } from '../sculpt/compile'
import { findCollisions } from '../geometry/collision'

describe('modelli 3D come oggetti', () => {
  it('le dimensioni sono quelle dell’ingombro del modello', () => {
    const doc = sampleSculpt()
    const o = objectFromSculpt(doc, 'Fungo', [1, 1])!
    const b = compileSculpt(doc).bounds!
    for (let i = 0; i < 3; i++) expect(o.size[i]).toBeCloseTo(b.max[i] - b.min[i], 3)
    expect(o.defaultSize).toEqual(o.size)
    expect(o.name).toBe('Fungo')
  })

  it('l’oggetto tiene una copia indipendente del modello', () => {
    const doc = sampleSculpt()
    const o = objectFromSculpt(doc, 'Fungo', [0, 0])!
    doc.nodes[0].color = '#000000'
    expect(o.sculpt!.nodes[0].color).not.toBe('#000000')
  })

  it('un modello vuoto non diventa un oggetto', () => {
    expect(objectFromSculpt(emptySculptDoc(), 'Vuoto', [0, 0])).toBeNull()
  })

  it('sopravvive al salvataggio e collide come gli altri oggetti', () => {
    const p = newProject('space')
    const fungo = objectFromSculpt(sampleSculpt(), 'Fungo', [2, 1.5])!
    const cubo = newObject(PRIMITIVES[0], [2, 1.5])
    p.objects.push(fungo, cubo)
    const again = parseProject(JSON.parse(JSON.stringify(p)))
    expect(again.objects[0].sculpt).toEqual(fungo.sculpt)
    expect(findCollisions(again).ids.has(fungo.id)).toBe(true)
    // spostato lontano non collide più
    again.objects[1] = { ...again.objects[1], position: [0.5, 0.5] }
    expect(findCollisions({ ...again, objects: [...again.objects] }).ids.has(fungo.id)).toBe(false)
  })

  it('gli oggetti dei progetti vecchi non hanno modello', () => {
    const p = newProject('space')
    const o = newObject(PRIMITIVES[0], [1, 1]) as Record<string, unknown>
    delete o.sculpt
    p.objects.push(o as never)
    expect(parseProject(JSON.parse(JSON.stringify(p))).objects[0].sculpt).toBeNull()
  })
})
