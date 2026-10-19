import { BufferAttribute, Color, QuadraticBezierCurve3, TubeGeometry, Vector3, type BufferGeometry } from 'three'

let cached: BufferGeometry | null = null

/**
 * Banana procedurale: tubo pentagonale lungo un arco, rastremato alle estremità,
 * con punte marroni e picciolo verdognolo (colori di vertice moltiplicati per il colore
 * dell'oggetto). Normalizzata in un cubo unitario centrato nell'origine.
 */
export function bananaGeometry(): BufferGeometry {
  if (cached) return cached
  const curve = new QuadraticBezierCurve3(new Vector3(-1, 0, 0.3), new Vector3(0, 0, -0.5), new Vector3(1, 0, 0.3))
  const tubular = 64
  const radial = 5
  const geo = new TubeGeometry(curve, tubular, 0.2, radial, false)

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const v = new Vector3()
  const c = new Vector3()
  const body = new Color(1, 1, 1)
  const stem = new Color(0.55, 0.6, 0.3)
  const tip = new Color(0.25, 0.17, 0.08)
  const col = new Color()
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular
    curve.getPointAt(u, c)
    // rastremazione: picciolo sottile ma non nullo all'inizio, punta più appuntita alla fine
    const taper = u < 0.12 ? 0.28 + u * 2 : Math.max(0.12, Math.pow(Math.sin(Math.PI * Math.min(u, 0.98)), 0.45))
    if (u < 0.1) col.copy(stem)
    else if (u < 0.16) col.copy(stem).lerp(body, (u - 0.1) / 0.06)
    else if (u > 0.96) col.copy(tip)
    else col.copy(body)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(taper).add(c)
      pos.setXYZ(k, v.x, v.y, v.z)
      col.toArray(colors, k * 3)
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))

  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  geo.translate(-center.x, -center.y, -center.z)
  geo.scale(1 / size.x, 1 / size.y, 1 / size.z)
  geo.computeVertexNormals()
  cached = geo
  return geo
}
