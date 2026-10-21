import { useEffect, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { BackSide, Color, Matrix4, ShaderMaterial, Vector3, Vector4 } from 'three'
import { useProject } from '../store/projectStore'
import { compileSculpt, sculptGLSL, sculptUniforms, type CompiledSculpt } from '../sculpt/compile'
import { SCULPT_VERTEX, sculptFragment, shadowFragment } from '../sculpt/glsl'
import { useResolvedTheme } from '../theme'
import { pickSculpt } from '../sculpt/pick'
import { useUi } from '../store/uiStore'
import { gizmoBusy } from './Gizmo'
import { pickNode } from '../store/sculptActions'

/** luce principale: dall'alto, davanti a destra */
const LIGHT = new Vector3(0.5, 0.9, 0.35).normalize()
const noRaycast = () => null

function baseUniforms(n: number) {
  return {
    uInv: { value: Array.from({ length: n }, () => new Matrix4()) },
    uParam: { value: Array.from({ length: n }, () => new Vector4()) },
    uColor: { value: Array.from({ length: n }, () => new Vector4()) },
    uMat: { value: Array.from({ length: n }, () => new Vector4()) },
    uDefaultMat: { value: new Vector4() },
    uLight: { value: LIGHT.clone() },
  }
}

/** Copia nel materiale i valori correnti del modello (senza ricompilare lo shader) */
function applyUniforms(mat: ShaderMaterial, c: CompiledSculpt) {
  const u = sculptUniforms(c)
  const inv = mat.uniforms.uInv.value as Matrix4[]
  const param = mat.uniforms.uParam.value as Vector4[]
  const color = mat.uniforms.uColor.value as Vector4[]
  const finish = mat.uniforms.uMat.value as Vector4[]
  for (let i = 0; i < u.count; i++) {
    inv[i].copy(u.inv[i])
    param[i].fromArray(u.param[i])
    color[i].fromArray(u.color[i])
    finish[i].fromArray(u.mat[i])
  }
  ;(mat.uniforms.uDefaultMat.value as Vector4).fromArray(c.defaultMat)
}

/**
 * Modello 3D disegnato col ray marching: un parallelepipedo che racchiude il modello fa da
 * "schermo" e il fragment shader cerca la superficie lungo il raggio della camera.
 * Lo shader si ricompila solo quando cambia la struttura del modello.
 */
export function SculptView() {
  const doc = useProject((s) => s.project.sculpt)
  const theme = useResolvedTheme()
  const compiled = useMemo(() => (doc ? compileSculpt(doc) : null), [doc])
  const key = compiled?.key ?? ''
  const count = Math.max(compiled?.count ?? 1, 1)

  const { model, shadow } = useMemo(() => {
    const glsl = compiled ? sculptGLSL(compiled) : 'float sceneMap(vec3 p, out vec3 col, out vec4 mat) { col = NEUTRAL; mat = uDefaultMat; return FAR; }'
    const model = new ShaderMaterial({
      vertexShader: SCULPT_VERTEX,
      fragmentShader: sculptFragment(count, glsl),
      uniforms: {
        ...baseUniforms(count),
        uProj: { value: new Matrix4() },
        uBoxMin: { value: new Vector3() },
        uBoxMax: { value: new Vector3() },
        uSky: { value: new Color() },
        uGround: { value: new Color() },
      },
      side: BackSide,
    })
    const shadow = new ShaderMaterial({
      vertexShader: SCULPT_VERTEX,
      fragmentShader: shadowFragment(count, glsl),
      uniforms: {
        ...baseUniforms(count),
        uCenter: { value: new Vector3() },
        uRadius: { value: 1 },
        uStrength: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    })
    return { model, shadow }
    // la chiave descrive la struttura: è l'unica cosa che richiede un nuovo shader
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, count])

  useEffect(() => {
    // un nuovo shader riparte senza errori: se non compila, onShaderError riporterà il messaggio
    useUi.getState().setRenderError(null)
    return () => {
      model.dispose()
      shadow.dispose()
    }
  }, [model, shadow])

  // valori del modello e del tema: aggiornati a ogni modifica, senza ricompilare
  useEffect(() => {
    if (!compiled || !doc) return
    applyUniforms(model, compiled)
    applyUniforms(shadow, compiled)
    const dark = theme === 'dark'
    ;(model.uniforms.uSky.value as Color).set(dark ? '#5d6f7d' : '#c9dcef')
    ;(model.uniforms.uGround.value as Color).set(dark ? '#2a2b25' : '#b8b2a4')
    shadow.uniforms.uStrength.value = dark ? 1.3 : 1
  }, [compiled, doc, model, shadow, theme])

  useFrame(({ camera }) => {
    ;(model.uniforms.uProj.value as Matrix4).copy(camera.projectionMatrix)
  })

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || gizmoBusy() || !compiled || useUi.getState().tool !== 'select') return
    const { origin, direction } = e.ray
    const hit = pickSculpt(compiled, [origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z])
    if (!hit) return // nessuna forma: il clic passa al pavimento, che deseleziona
    e.stopPropagation()
    const n = e.nativeEvent
    pickNode(hit.nodeId, n.ctrlKey || n.metaKey || n.shiftKey)
  }

  const b = compiled?.bounds
  if (!b) return null
  // un margine evita che il raggio entri già a ridosso della superficie
  const pad = 0.01
  const min = new Vector3(b.min[0] - pad, b.min[1] - pad, b.min[2] - pad)
  const max = new Vector3(b.max[0] + pad, b.max[1] + pad, b.max[2] + pad)
  ;(model.uniforms.uBoxMin.value as Vector3).copy(min)
  ;(model.uniforms.uBoxMax.value as Vector3).copy(max)
  const center = min.clone().add(max).multiplyScalar(0.5)
  const size = max.clone().sub(min)
  const radius = Math.max(size.x, size.z, size.y) * 1.6 + 0.1
  ;(shadow.uniforms.uCenter.value as Vector3).copy(center)
  shadow.uniforms.uRadius.value = radius

  return (
    <>
      {/* il parallelepipedo riceve i clic: la forma colpita si trova col ray marching in TypeScript */}
      <mesh position={center} scale={size} material={model} renderOrder={1} onClick={onPick}>
        <boxGeometry />
      </mesh>
      {/* l'ombra si disegna solo se il modello è (almeno in parte) sopra il pavimento */}
      {max.y > 0 && (
        <mesh position={[center.x, 0.0005, center.z]} rotation={[-Math.PI / 2, 0, 0]} material={shadow} raycast={noRaycast} renderOrder={2}>
          <planeGeometry args={[radius * 2, radius * 2]} />
        </mesh>
      )}
    </>
  )
}
