import { describe, expect, it } from 'vitest'
import { compileSculpt } from './compile'
import { meshSculpt } from './mesh'
import { toOBJ, toSTL } from './exportFormats'
import { emptySculptDoc, newSculptNode } from '../model/sculpt'

// cubo 20 cm appoggiato sul piano (y da 0 a 0.2), rosso
const cube = meshSculpt(
  compileSculpt({ ...emptySculptDoc(), nodes: [newSculptNode('box', { position: [0, 0.1, 0], size: [0.2, 0.2, 0.2], color: '#ff0000' })] }),
  40,
)!

describe('formati di esportazione', () => {
  it('STL binario: intestazione, numero di triangoli e dimensione', () => {
    const buf = toSTL(cube, 1000)
    const view = new DataView(buf)
    const triangles = cube.indices.length / 3
    expect(view.getUint32(80, true)).toBe(triangles)
    expect(buf.byteLength).toBe(84 + 50 * triangles)
  })

  it('STL in millimetri con Z verso l’alto e normali verso l’esterno', () => {
    const view = new DataView(toSTL(cube, 1000))
    const triangles = view.getUint32(80, true)
    let minZ = Infinity
    let maxZ = -Infinity
    let outward = 0
    for (let t = 0; t < triangles; t++) {
      const o = 84 + t * 50
      const n = [0, 1, 2].map((i) => view.getFloat32(o + i * 4, true))
      const v = [0, 1, 2].map((i) => view.getFloat32(o + 12 + i * 4, true))
      minZ = Math.min(minZ, v[2])
      maxZ = Math.max(maxZ, v[2])
      // il centro del cubo è a (0, 0, 100) mm: la normale deve allontanarsene
      if (n[0] * v[0] + n[1] * v[1] + n[2] * (v[2] - 100) > 0) outward++
    }
    expect(minZ).toBeCloseTo(0, 0)
    expect(maxZ).toBeCloseTo(200, 0)
    expect(outward).toBe(triangles)
  })

  it('OBJ: vertici con colore, normali e facce con indici da 1', () => {
    const obj = toOBJ(cube, 1, 'Cubo rosso')
    const lines = obj.trim().split('\n')
    const v = lines.filter((l) => l.startsWith('v '))
    const f = lines.filter((l) => l.startsWith('f '))
    expect(lines).toContain('o Cubo_rosso')
    expect(v).toHaveLength(cube.positions.length / 3)
    expect(lines.filter((l) => l.startsWith('vn '))).toHaveLength(cube.positions.length / 3)
    expect(f).toHaveLength(cube.indices.length / 3)
    // colore in sRGB: rosso pieno
    expect(v[0].split(' ').slice(4).map(Number)).toEqual([1, 0, 0])
    const maxIndex = Math.max(...f.flatMap((l) => l.slice(2).split(' ').map((x) => Number(x.split('//')[0]))))
    expect(maxIndex).toBe(v.length)
  })
})
