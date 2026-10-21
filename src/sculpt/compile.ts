import { Color, Matrix4, Vector3 } from 'three'
import { localMatrix } from './transform'
import { childrenOf, type SculptDoc, type SculptOp, type SculptShape } from '../model/sculpt'
import { FAR, opIntersect, opSubtract, opUnion, sdShape, type RGB, type Sample, type V3 } from './sdf'

/*
 * "Compilazione" del documento: l'albero delle forme visibili diventa
 *  - un programma (CompiledItem[]) valutabile in TypeScript, per selezione ed esportazione;
 *  - il codice GLSL della funzione sceneMap, identico nella struttura;
 *  - gli array di uniform con trasformazioni, dimensioni, colori e fusioni.
 * Il codice GLSL dipende solo dalla struttura (forme, operazioni, annidamento, simmetria):
 * finché `key` non cambia basta aggiornare gli uniform, senza ricompilare lo shader.
 */

export interface CompiledShape {
  type: 'shape'
  index: number
  nodeId: string
  shape: SculptShape
  op: SculptOp
  /** da mondo a spazio locale della forma (colonne, come Matrix4.elements) */
  inv: Matrix4
  /** fattore che riporta la distanza locale in unità del mondo (scala minima dei gruppi) */
  distScale: number
  size: V3
  round: number
  /** colore lineare */
  color: RGB
  blend: number
}

export interface CompiledGroup {
  type: 'group'
  index: number
  nodeId: string
  op: SculptOp
  blend: number
  children: CompiledItem[]
}

export type CompiledItem = CompiledShape | CompiledGroup

export interface Bounds {
  min: V3
  max: V3
}

export interface CompiledSculpt {
  items: CompiledItem[]
  /** numero di nodi con un indice negli uniform (forme e gruppi visibili) */
  count: number
  /** firma della struttura: se cambia, lo shader va ricompilato */
  key: string
  symmetry: { x: boolean; y: boolean; z: boolean }
  /** ingombro prudente del modello nel mondo; null se non c'è nulla da disegnare */
  bounds: Bounds | null
  /** nodo per indice */
  nodeIds: string[]
}

function linearColor(hex: string): RGB {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}

const cache = new WeakMap<SculptDoc, CompiledSculpt>()

export function compileSculpt(doc: SculptDoc): CompiledSculpt {
  const cached = cache.get(doc)
  if (cached) return cached

  const nodeIds: string[] = []
  let min: V3 = [Infinity, Infinity, Infinity]
  let max: V3 = [-Infinity, -Infinity, -Infinity]
  const keyParts: string[] = []

  const walk = (parentId: string | null, parentWorld: Matrix4, distScale: number, additive: boolean): CompiledItem[] => {
    const items: CompiledItem[] = []
    keyParts.push('(')
    for (const n of childrenOf(doc, parentId)) {
      if (n.hidden) continue
      const index = nodeIds.length
      nodeIds.push(n.id)
      const world = parentWorld.clone().multiply(localMatrix(n))
      // una forma che scava o interseca non allarga mai l'ingombro
      const adds = additive && n.op === 'add'
      if (n.kind === 'group') {
        keyParts.push(`g${n.op[0]}`)
        const scale = Math.min(...n.size)
        const children = walk(n.id, world, distScale * scale, adds)
        items.push({ type: 'group', index, nodeId: n.id, op: n.op, blend: n.blend, children })
      } else {
        keyParts.push(`${n.kind}${n.op[0]}`)
        items.push({
          type: 'shape',
          index,
          nodeId: n.id,
          shape: n.kind,
          op: n.op,
          inv: world.clone().invert(),
          distScale,
          size: [...n.size],
          round: n.round,
          color: linearColor(n.color),
          blend: n.blend,
        })
        if (adds) {
          // gli 8 vertici del parallelepipedo della forma, portati nel mondo; la fusione può gonfiare di ~k/4
          const pad = n.blend * 0.5
          for (const sx of [-0.5, 0.5])
            for (const sy of [-0.5, 0.5])
              for (const sz of [-0.5, 0.5]) {
                const v = new Vector3(sx * n.size[0], sy * n.size[1], sz * n.size[2]).applyMatrix4(world)
                min = [Math.min(min[0], v.x - pad), Math.min(min[1], v.y - pad), Math.min(min[2], v.z - pad)]
                max = [Math.max(max[0], v.x + pad), Math.max(max[1], v.y + pad), Math.max(max[2], v.z + pad)]
              }
        }
      }
    }
    keyParts.push(')')
    return items
  }

  const items = walk(null, new Matrix4(), 1, true)
  const sym = { ...doc.symmetry }
  let bounds: Bounds | null = Number.isFinite(min[0]) ? { min, max } : null
  if (bounds) {
    // con la simmetria la metà positiva viene specchiata su quella negativa
    const b = bounds
    const axes = [sym.x, sym.y, sym.z]
    axes.forEach((on, i) => {
      if (!on) return
      const m = Math.max(b.max[i], 0)
      if (m <= 0) bounds = null
      else {
        b.min[i] = -m
        b.max[i] = m
      }
    })
  }
  const result: CompiledSculpt = {
    items,
    count: nodeIds.length,
    key: `${keyParts.join('')}|${sym.x ? 'x' : ''}${sym.y ? 'y' : ''}${sym.z ? 'z' : ''}`,
    symmetry: sym,
    bounds,
    nodeIds,
  }
  cache.set(doc, result)
  return result
}

// ---------- valutazione in TypeScript ----------

function combine(op: SculptOp, a: Sample, b: Sample, k: number): Sample {
  return op === 'add' ? opUnion(a, b, k) : op === 'subtract' ? opSubtract(a, b, k) : opIntersect(a, b, k)
}

const NEUTRAL: RGB = [0.8, 0.8, 0.8]

function evalItems(items: CompiledItem[], p: Vector3): Sample {
  let acc: Sample = { d: FAR, c: NEUTRAL }
  for (const it of items) {
    let s: Sample
    if (it.type === 'shape') {
      const q = p.clone().applyMatrix4(it.inv)
      s = { d: sdShape(it.shape, [q.x, q.y, q.z], it.size, it.round) * it.distScale, c: it.color }
    } else s = evalItems(it.children, p)
    acc = combine(it.op, acc, s, it.blend)
  }
  return acc
}

/** Distanza (m) e colore lineare del modello nel punto p del mondo */
export function evaluateSculpt(c: CompiledSculpt, p: V3): Sample {
  const q = new Vector3(c.symmetry.x ? Math.abs(p[0]) : p[0], c.symmetry.y ? Math.abs(p[1]) : p[1], c.symmetry.z ? Math.abs(p[2]) : p[2])
  return evalItems(c.items, q)
}

// ---------- uniform e GLSL ----------

/** Array per gli uniform uInv (mat4), uParam (dimensioni + arrotondamento), uColor (colore + fusione) */
export function sculptUniforms(c: CompiledSculpt) {
  const n = Math.max(c.count, 1)
  const inv = Array.from({ length: n }, () => new Matrix4())
  const param = Array.from({ length: n }, () => new Float32Array(4))
  const color = Array.from({ length: n }, () => new Float32Array(4))
  const visit = (items: CompiledItem[]) => {
    for (const it of items) {
      if (it.type === 'shape') {
        const m = it.inv.clone()
        // la riga 3 delle colonne 0..2 di una matrice affine è inutilizzata: lì va il fattore di distanza
        m.elements[3] = it.distScale
        inv[it.index] = m
        param[it.index].set([it.size[0], it.size[1], it.size[2], it.round])
        color[it.index].set([it.color[0], it.color[1], it.color[2], it.blend])
      } else {
        color[it.index].set([0, 0, 0, it.blend])
        visit(it.children)
      }
    }
  }
  visit(c.items)
  return { count: n, inv, param, color }
}

const GL_SHAPE: Record<SculptShape, string> = {
  sphere: 'sdSphere',
  box: 'sdBox',
  cylinder: 'sdCylinder',
  cone: 'sdCone',
  torus: 'sdTorus',
  capsule: 'sdCapsule',
}
const GL_OP: Record<SculptOp, string> = { add: 'opUnion', subtract: 'opSubtract', intersect: 'opIntersect' }

/** Corpo GLSL della funzione `float sceneMap(vec3 p, out vec3 col)`, con la stessa struttura del programma */
export function sculptGLSL(c: CompiledSculpt): string {
  const lines: string[] = []
  const emit = (items: CompiledItem[], level: number, indent: string) => {
    const d = `d${level}`
    const col = `c${level}`
    for (const it of items) {
      const i = it.index
      if (it.type === 'shape') {
        lines.push(`${indent}{`)
        lines.push(`${indent}  vec3 q = (uInv[${i}] * vec4(p, 1.0)).xyz;`)
        lines.push(`${indent}  float d = ${GL_SHAPE[it.shape]}(q, uParam[${i}]) * uInv[${i}][0][3];`)
        lines.push(`${indent}  ${GL_OP[it.op]}(${d}, ${col}, d, uColor[${i}].rgb, uColor[${i}].w);`)
        lines.push(`${indent}}`)
      } else {
        const dn = `d${level + 1}`
        const cn = `c${level + 1}`
        lines.push(`${indent}{`)
        lines.push(`${indent}  float ${dn} = FAR; vec3 ${cn} = NEUTRAL;`)
        emit(it.children, level + 1, indent + '  ')
        lines.push(`${indent}  ${GL_OP[it.op]}(${d}, ${col}, ${dn}, ${cn}, uColor[${i}].w);`)
        lines.push(`${indent}}`)
      }
    }
  }
  const sym = c.symmetry
  if (sym.x) lines.push('  p.x = abs(p.x);')
  if (sym.y) lines.push('  p.y = abs(p.y);')
  if (sym.z) lines.push('  p.z = abs(p.z);')
  lines.push('  float d0 = FAR; vec3 c0 = NEUTRAL;')
  emit(c.items, 0, '  ')
  lines.push('  col = c0;')
  lines.push('  return d0;')
  return `float sceneMap(vec3 p, out vec3 col) {\n${lines.join('\n')}\n}`
}
