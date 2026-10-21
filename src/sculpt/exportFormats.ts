import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'
import type { SculptMesh } from './mesh'

/*
 * Formati di esportazione della mesh. Il modello è in metri con Y verso l'alto:
 *  - STL: binario, senza colori, con Z verso l'alto come si aspettano gli slicer;
 *  - OBJ: testo, Y verso l'alto, colori per vertice (estensione letta da Blender e MeshLab);
 *  - GLB: glTF binario, sempre in metri e Y verso l'alto (lo impone lo standard), con colori.
 * `scale` converte i metri nell'unità del file (1000 = millimetri).
 */

/** Da Y-su a Z-su: (x, y, z) → (x, −z, y); è una rotazione, quindi il verso dei triangoli resta valido */
const toZUp = (x: number, y: number, z: number): [number, number, number] => [x, -z, y]

export function toSTL(m: SculptMesh, scale: number): ArrayBuffer {
  const triangles = m.indices.length / 3
  const buffer = new ArrayBuffer(84 + triangles * 50)
  const view = new DataView(buffer)
  const header = 'banana33 - modello 3D'
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i))
  view.setUint32(80, triangles, true)
  const p = m.positions
  let o = 84
  for (let t = 0; t < m.indices.length; t += 3) {
    const v = [m.indices[t], m.indices[t + 1], m.indices[t + 2]].map((i) => toZUp(p[i * 3] * scale, p[i * 3 + 1] * scale, p[i * 3 + 2] * scale))
    // normale della faccia dal prodotto vettoriale
    const ux = v[1][0] - v[0][0]
    const uy = v[1][1] - v[0][1]
    const uz = v[1][2] - v[0][2]
    const wx = v[2][0] - v[0][0]
    const wy = v[2][1] - v[0][1]
    const wz = v[2][2] - v[0][2]
    let nx = uy * wz - uz * wy
    let ny = uz * wx - ux * wz
    let nz = ux * wy - uy * wx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l
    ny /= l
    nz /= l
    for (const value of [nx, ny, nz, ...v[0], ...v[1], ...v[2]]) {
      view.setFloat32(o, value, true)
      o += 4
    }
    view.setUint16(o, 0, true)
    o += 2
  }
  return buffer
}

export function toOBJ(m: SculptMesh, scale: number, name: string): string {
  const lines = [`# banana33 - modello 3D`, `o ${name.replace(/\s+/g, '_') || 'modello'}`]
  const p = m.positions
  const c = new Color()
  for (let i = 0; i < p.length; i += 3) {
    // colori in sRGB, come li leggono i programmi che supportano "v x y z r g b"
    c.setRGB(m.colors[i], m.colors[i + 1], m.colors[i + 2]).convertLinearToSRGB()
    lines.push(`v ${fmt(p[i] * scale)} ${fmt(p[i + 1] * scale)} ${fmt(p[i + 2] * scale)} ${fmt(c.r)} ${fmt(c.g)} ${fmt(c.b)}`)
  }
  for (let i = 0; i < m.normals.length; i += 3) lines.push(`vn ${fmt(m.normals[i])} ${fmt(m.normals[i + 1])} ${fmt(m.normals[i + 2])}`)
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, d] = [m.indices[t] + 1, m.indices[t + 1] + 1, m.indices[t + 2] + 1]
    lines.push(`f ${a}//${a} ${b}//${b} ${d}//${d}`)
  }
  return lines.join('\n') + '\n'
}

const fmt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : Number(v.toPrecision(7)).toString())

export async function toGLB(m: SculptMesh, name: string): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(m.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(m.normals, 3))
  geometry.setAttribute('color', new BufferAttribute(m.colors, 3))
  geometry.setIndex(new BufferAttribute(m.indices, 1))
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }))
  mesh.name = name || 'modello'
  const result = await new GLTFExporter().parseAsync(mesh, { binary: true })
  geometry.dispose()
  return result as ArrayBuffer
}
