import { Edges } from '@react-three/drei'
import { useProject } from '../store/projectStore'

/** Il volume contenitore della verifica di ingombro */
export function SpaceBox() {
  const space = useProject((s) => s.project.space)
  if (!space) return null
  const { width: w, depth: d, height: h } = space
  return (
    <group raycast={() => null}>
      <mesh position={[w / 2, 0.0005, d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[w / 2, h / 2, d / 2]} raycast={() => null}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0.04} color="#2f6fed" depthWrite={false} />
        <Edges color="#2f6fed" />
      </mesh>
    </group>
  )
}
