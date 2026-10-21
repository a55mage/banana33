import { beforeEach, describe, expect, it } from 'vitest'
import { useProject } from './projectStore'
import { useUi } from './uiStore'
import { newProject } from '../model/factory'
import { emptySculptDoc, childrenOf, type SculptDoc } from '../model/sculpt'
import { setGpuFragmentUniforms } from '../sculpt/limits'
import {
  addShape,
  pickNode,
  selectedNodeIds,
  updateNodes,
  deleteNodes,
  duplicateNodes,
  groupNodes,
  moveNode,
  setSculptMaterial,
  toggleSymmetry,
  ungroupNode,
  updateNode,
} from './sculptActions'

const doc = () => useProject.getState().project.sculpt as SculptDoc
const names = (parentId: string | null = null) => childrenOf(doc(), parentId).map((n) => n.name)

beforeEach(() => {
  const p = newProject('model')
  p.sculpt = emptySculptDoc()
  useProject.getState().load(p)
})

describe('azioni del modello 3D', () => {
  it('aggiunge forme in fondo e seleziona la nuova', () => {
    const a = addShape('sphere', { name: 'A' })
    addShape('box', { name: 'B' })
    expect(names()).toEqual(['A', 'B'])
    expect(useUi.getState().selection).toEqual({ type: 'node', id: doc().nodes[1].id })
    expect(a).toBe(doc().nodes[0].id)
  })

  it('aggiunge dentro il gruppo selezionato', () => {
    const a = addShape('sphere', { name: 'A' })!
    const g = groupNodes([a])!
    addShape('box', { name: 'B' })
    expect(names(g)).toEqual(['A', 'B'])
  })

  it('modifica, annulla e ripete', () => {
    const a = addShape('sphere', { name: 'A' })!
    updateNode(a, { op: 'subtract', blend: 0.05 })
    expect(doc().nodes[0]).toMatchObject({ op: 'subtract', blend: 0.05 })
    useProject.getState().undo()
    expect(doc().nodes[0]).toMatchObject({ op: 'add', blend: 0.02 })
    useProject.getState().redo()
    expect(doc().nodes[0].op).toBe('subtract')
  })

  it('elimina un gruppo con tutto il contenuto', () => {
    const a = addShape('sphere', { name: 'A' })!
    const b = addShape('box', { name: 'B' })!
    const g = groupNodes([a, b])!
    addShape('cone', { name: 'C', parentId: null })
    deleteNodes([g])
    expect(doc().nodes.map((n) => n.name)).toEqual(['C'])
  })

  it('duplica un gruppo con nuovi id subito dopo l’originale', () => {
    const a = addShape('sphere', { name: 'A' })!
    const g = groupNodes([a])!
    addShape('cone', { name: 'C', parentId: null })
    const [copy] = duplicateNodes([g])
    const root = childrenOf(doc(), null)
    expect(root.map((n) => n.id)).toEqual([g, copy, root[2].id])
    expect(childrenOf(doc(), copy)).toHaveLength(1)
    expect(childrenOf(doc(), copy)[0].id).not.toBe(a)
  })

  it('riordina e sposta dentro e fuori dai gruppi', () => {
    const a = addShape('sphere', { name: 'A' })!
    const b = addShape('box', { name: 'B', parentId: null })!
    const c = addShape('cone', { name: 'C', parentId: null })!
    moveNode(c, { parentId: null, beforeId: a })
    expect(names()).toEqual(['C', 'A', 'B'])
    const g = groupNodes([b])!
    moveNode(a, { parentId: g })
    expect(names(g)).toEqual(['B', 'A'])
    // un gruppo non può entrare in sé stesso
    moveNode(g, { parentId: g })
    expect(doc().nodes.find((n) => n.id === g)!.parentId).toBeNull()
  })

  it('sciogliendo un gruppo la sua trasformazione passa ai figli', () => {
    const a = addShape('box', { name: 'A', position: [0.1, 0, 0], size: [0.1, 0.2, 0.3] })!
    const g = groupNodes([a])!
    updateNode(g, { position: [1, 0, 0], rotation: [0, 90, 0], size: [2, 2, 2] })
    ungroupNode(g)
    const n = doc().nodes.find((x) => x.id === a)!
    expect(n.parentId).toBeNull()
    // (0.1, 0, 0) scalato ×2 e ruotato di 90° su Y finisce in (0, 0, −0.2), poi traslato di +1 su X
    expect(n.position[0]).toBeCloseTo(1)
    expect(n.position[2]).toBeCloseTo(-0.2)
    expect(n.rotation[1]).toBeCloseTo(90)
    expect(n.size).toEqual([0.2, 0.4, 0.6])
    expect(doc().nodes.some((x) => x.id === g)).toBe(false)
  })

  it('materiale e simmetria', () => {
    setSculptMaterial('metal')
    toggleSymmetry('x')
    expect(doc().material).toBe('metal')
    expect(doc().symmetry).toEqual({ x: true, y: false, z: false })
  })

  it('selezione multipla con Ctrl/Shift e modifica di tutte le forme insieme', () => {
    const a = addShape('sphere', { name: 'A' })!
    const b = addShape('box', { name: 'B' })!
    pickNode(a)
    pickNode(b, true)
    expect(selectedNodeIds()).toEqual([a, b])
    expect(useUi.getState().selection?.type).toBe('nodes')
    updateNodes(selectedNodeIds(), { op: 'subtract' })
    expect(doc().nodes.every((n) => n.op === 'subtract')).toBe(true)
    // un solo passo di annulla per tutte
    useProject.getState().undo()
    expect(doc().nodes.every((n) => n.op === 'add')).toBe(true)
    // Ctrl+clic su una già selezionata la toglie
    pickNode(a, true)
    expect(useUi.getState().selection).toEqual({ type: 'node', id: b })
  })

  it('oltre il limite della scheda video non si aggiungono forme', () => {
    setGpuFragmentUniforms(32 + 7 * 16) // 16 nodi
    for (let i = 0; i < 16; i++) expect(addShape('sphere')).not.toBeNull()
    expect(addShape('sphere')).toBeNull()
    expect(duplicateNodes([doc().nodes[0].id])).toEqual([])
    expect(useUi.getState().notice).toContain('16')
    expect(doc().nodes).toHaveLength(16)
    setGpuFragmentUniforms(4096)
  })

  it('fuori da un modello 3D le azioni non fanno nulla', () => {
    useProject.getState().load(newProject('plan'))
    expect(addShape('sphere')).toBeNull()
    expect(useProject.getState().project.sculpt).toBeNull()
  })
})
