import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointMaterial, Points, Sphere, MeshDistortMaterial, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { MotionValue } from 'motion/react';

interface ParticleFieldProps {
  count?: number;
  scrollProgress?: MotionValue<number>;
}

function BezierPulse({ start, end, color }: { start: THREE.Vector3, end: THREE.Vector3, color: string }) {
  const points = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += Math.random() * 50 - 25;
    mid.z += Math.random() * 50 - 25;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(20);
  }, [start, end]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.15}
    />
  );
}

function LiquidMercuryCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <Sphere ref={meshRef} args={[40, 100, 100]}>
        <MeshDistortMaterial
          color="#ffffff"
          speed={3}
          distort={0.4}
          radius={1}
          metalness={0.9}
          roughness={0.1}
          emissive="#ffffff"
          emissiveIntensity={0.1}
        />
      </Sphere>
    </Float>
  );
}

function ParticleField({ count = 3000, scrollProgress }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<Float32Array | null>(null);

  if (!particlesRef.current) {
    const particles = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      particles[i] = (Math.random() - 0.5) * 2000;
      particles[i + 1] = (Math.random() - 0.5) * 2000;
      particles[i + 2] = (Math.random() - 0.5) * 2000;
    }
    particlesRef.current = particles;
  }

  useFrame((state) => {
    if (!pointsRef.current) return;
    const progress = scrollProgress ? scrollProgress.get() : 0;
    pointsRef.current.rotation.x += 0.0001 + (progress * 0.002);
    pointsRef.current.rotation.y += 0.00015 + (progress * 0.003);
    const targetScale = 1 + (progress * 0.5);
    pointsRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  return (
    <Points 
      ref={pointsRef} 
      positions={particlesRef.current} 
      stride={3} 
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        color="#ffffff"
        size={2}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
}

function NeuralNetwork({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const progress = scrollProgress ? scrollProgress.get() : 0;
    groupRef.current.rotation.z += 0.0003 + (progress * 0.001);
  });

  const pulses = useMemo(() => {
    return [...Array(5)].map((_, i) => (
      <BezierPulse 
        key={i}
        start={new THREE.Vector3(0, 0, 0)}
        end={new THREE.Vector3((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400)}
        color="#f5f5f7"
      />
    ));
  }, []);

  return (
    <group ref={groupRef}>
      <LiquidMercuryCore />
      <ParticleField count={2500} scrollProgress={scrollProgress} />
      {pulses}
    </group>
  );
}

function SceneFallback() {
  return null;
}

interface Hero3DProps {
  height?: string;
  autoRotate?: boolean;
  scrollProgress?: MotionValue<number>;
}

export const Hero3D = ({ height = '400px', autoRotate = true, scrollProgress }: Hero3DProps) => {
  const isMobile = typeof window !== 'undefined' && 
    window.matchMedia('(max-width: 768px)').matches;
  
  const neuralNetwork = useMemo(() => (
    autoRotate && <NeuralNetwork scrollProgress={scrollProgress} />
  ), [autoRotate, scrollProgress]);

  if (isMobile) {
    return (
      <div style={{ width: '100%', height, background: '#050505', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666', fontSize: '12px' }}>3D Visualization Active</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, position: 'relative', borderRadius: '20px', overflow: 'hidden', background: '#050505' }}>
      <Canvas 
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        camera={{ position: [0, 0, 300], fov: 75 }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
      >
        <Suspense fallback={<SceneFallback />}>
          <ambientLight intensity={0.5} />
          <pointLight position={[100, 100, 100]} intensity={2} />
          <pointLight position={[-100, -100, -100]} intensity={1} color="#86868b" />
          {neuralNetwork}
        </Suspense>
      </Canvas>
    </div>
  );
};
