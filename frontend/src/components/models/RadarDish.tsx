// RadarDish.tsx — fully procedural, no GLB needed
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'

export function RadarDish(props: any) {
  const dishRef = useRef<THREE.Group>(null)

  // DISH SURFACE — paraboloid via ParametricGeometry
  const paraboloidFunc = (u: number, v: number, target: THREE.Vector3) => {
    const r = v * 4          // dish radius 4 units
    const theta = u * Math.PI * 2
    const x = r * Math.cos(theta)
    const z = r * Math.sin(theta)
    const y = (r * r) / 8   // parabola: y = r²/focal_depth
    target.set(x, -y, z)    // negative y = dish opens upward
  }

  const dishGeometry = new ParametricGeometry(paraboloidFunc, 48, 16)
  const panelWireframe = new THREE.WireframeGeometry(dishGeometry)
  const strutGeometry = new THREE.BoxGeometry(0.05, 4.0, 0.05)
  const hornGeometry = new THREE.CylinderGeometry(0.08, 0.15, 0.4, 8)
  const mountGeometry = new THREE.CylinderGeometry(0.1, 0.15, 2.5, 12)

  useFrame((state) => {
    if (dishRef.current) {
      dishRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * (Math.PI / 4)
    }
  })

  const metalMaterial = new THREE.MeshStandardMaterial({ color: '#3a3a3a', metalness: 0.85, roughness: 0.35 })
  const strutMaterial = new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.6, roughness: 0.6 })
  const wireMaterial = new THREE.LineBasicMaterial({ color: '#555555', opacity: 0.4, transparent: true })

  return (
    <group ref={dishRef} {...props}>
      <mesh geometry={dishGeometry} material={metalMaterial} />
      <lineSegments geometry={panelWireframe} material={wireMaterial} />
      {[0, 90, 180, 270].map((angle, i) => (
        <group key={i} rotation={[0, (angle * Math.PI) / 180, 0]}>
          <mesh
            geometry={strutGeometry}
            material={strutMaterial}
            position={[2, -1.9, 0]}
            rotation={[0, 0, Math.PI / 2]}
          />
        </group>
      ))}
      <mesh geometry={hornGeometry} material={strutMaterial} position={[0, -1.8, 0]} rotation={[Math.PI, 0, 0]} />
      <mesh geometry={mountGeometry} material={strutMaterial} position={[0, 1.5, 0]} />
    </group>
  )
}
