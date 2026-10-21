import { describe, expect, it } from 'vitest'
import { parseProject } from './schema'
import { newProject } from './factory'

const base = { schemaVersion: 1, id: 'x', name: 'n', createdAt: 0, updatedAt: 0, walls: [], openings: [], objects: [] }

describe('migrazione dei progetti', () => {
  it('un progetto vecchio con contenitore diventa uno spazio', () => {
    const p = parseProject({ ...base, space: { width: 5, depth: 4, height: 3 } })
    expect(p.kind).toBe('space')
    expect(p.space).toEqual({ width: 5, depth: 4, height: 3 })
    expect(p.sculpt).toBeNull()
  })

  it('un progetto vecchio senza contenitore diventa una planimetria', () => {
    const p = parseProject({ ...base, space: null })
    expect(p.kind).toBe('plan')
    expect(p.space).toBeNull()
  })

  it('uno spazio ha sempre il contenitore e una planimetria mai', () => {
    expect(parseProject({ ...base, kind: 'space', space: null }).space).not.toBeNull()
    expect(parseProject({ ...base, kind: 'plan', space: { width: 1, depth: 1, height: 1 } }).space).toBeNull()
  })

  it('un modello 3D senza documento riceve un documento vuoto', () => {
    const p = parseProject({ ...base, kind: 'model', space: null })
    expect(p.sculpt).toEqual({ nodes: [], material: 'glossy', symmetry: { x: false, y: false, z: false } })
  })

  it('rifiuta un tipo sconosciuto', () => {
    expect(() => parseProject({ ...base, kind: 'banana', space: null })).toThrow()
  })

  it('un nuovo modello 3D sopravvive al salvataggio JSON', () => {
    const p = newProject('model')
    const again = parseProject(JSON.parse(JSON.stringify(p)))
    expect(again).toEqual(p)
    expect(again.sculpt!.nodes.length).toBeGreaterThan(0)
  })
})
