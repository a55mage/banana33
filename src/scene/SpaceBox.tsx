import { Edges } from '@react-three/drei'
import { useProject } from '../store/projectStore'
import { useSceneTheme } from '../theme'
import { useUi } from '../store/uiStore'

/** Il volume contenitore della verifica di ingombro */
export function SpaceBox() {
  const space = useProject((s) => s.project.space)
  const theme = useSceneTheme()
  const plan = useUi((s) => s.view === '2d')
  if (!space) return null
  const { width: w, depth: d, height: h } = space
  return (
    <group raycast={() => null}>
      <mesh position={[w / 2, -0.004, d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[w, d]} />
        {/* in pianta il pavimento non è illuminato: resta del suo colore pieno */}
        {plan ? <meshBasicMaterial color={theme.floor} /> : <meshStandardMaterial color={theme.floor} />}
      </mesh>
      <mesh position={[w / 2, h / 2, d / 2]} raycast={() => null}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={theme.spaceFillOpacity} color={theme.spaceFill} depthWrite={false} />
        <Edges color={theme.spaceEdge} />
      </mesh>
    </group>
  )
}
