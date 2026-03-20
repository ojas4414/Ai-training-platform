import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonLoader } from './SkeletonLoader';

interface ModelViewerProps {
  modelPath: string;
  height?: string;
  autoRotate?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

function Model({ path, onError }: { path: string; onLoad?: () => void; onError?: (error: Error) => void }) {
  try {
    const { scene } = useGLTF(path);
    
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
      if (meshRef.current && !useGLTF.preload) {
        meshRef.current.rotation.y += 0.005;
      }
    });

    return (
      <PresentationControls
        speed={1.5}
        global
        zoom={1}
        rotation={[0, 0, 0]}
      >
        <primitive ref={meshRef} object={scene} />
      </PresentationControls>
    );
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    return null;
  }
}

export const ModelViewer = ({
  modelPath,
  height = '500px',
  onLoad,
  onError,
}: ModelViewerProps) => {
  const isMobile = typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches;

  if (isMobile) {
    return (
      <div
        style={{
          width: '100%',
          height,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        Model viewer not available on mobile
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height,
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 75 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <color attach="background" args={['#080608']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Suspense fallback={<SkeletonLoader />}>
          <Model path={modelPath} onLoad={onLoad} onError={onError} />
        </Suspense>
      </Canvas>
    </div>
  );
};

// Preload a model
export const preloadModel = (path: string) => {
  if (typeof window === 'undefined') return;
  useGLTF.preload(path);
};
