import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { GPURack } from './models/GPURack'
import { RadarDish } from './models/RadarDish'

export function ModelPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      
      {/* Red warning banner at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: '#E24B4A', color: 'white',
        padding: '12px', textAlign: 'center',
        fontFamily: 'monospace', fontSize: '14px', zIndex: 999
      }}>
        PREVIEW MODE — AWAITING USER APPROVAL — 
        DO NOT INTEGRATE INTO CINEMATIC SCENE
      </div>

      <Canvas camera={{ position: [0, 5, 25], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        <Environment preset="city" />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        
        <group position={[-5, 0, 0]}>
           <GPURack />
        </group>
        <group position={[5, -5, 0]} scale={0.5}>
           <RadarDish />
        </group>
        
        <OrbitControls />
      </Canvas>
    </div>
  )
}
