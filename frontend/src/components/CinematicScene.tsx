import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Stars, Environment, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Lazy loaded models to satisfy the 1-section-ahead preloading mandate
const NeuralHub = lazy(() => import('./models/NeuralHub').then(m => ({ default: m.NeuralHub })));
const GPURack = lazy(() => import('./models/GPURack').then(m => ({ default: m.GPURack })));
const ExperimentFlask = lazy(() => import('./models/ExperimentFlask').then(m => ({ default: m.ExperimentFlask })));
const RadarDish = lazy(() => import('./models/RadarDish').then(m => ({ default: m.RadarDish })));
const AssetHologram = lazy(() => import('./models/AssetHologram').then(m => ({ default: m.AssetHologram })));

// useGLTF.preload() called for all GLB models at app start
useGLTF.preload('/assets3d/gpu_rack.glb');

const cameraPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 12),      // Section 0: Hub (frontal)
  new THREE.Vector3(100, -2, 8),    // Section 1: Command Center (far offscreen)
  new THREE.Vector3(-28, 2, -16),   // Section 2: Experiment Builder
  new THREE.Vector3(2, 32, -36),    // Section 3: Search Studio
  new THREE.Vector3(42, -18, -26),  // Section 4: Assets Lab
]);

const lookPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(3, 0, 0),       // Model 1: NeuralHub
  new THREE.Vector3(100, -3, 3),    // Model 2: GPU Rack (far offscreen)
  new THREE.Vector3(-30, 0, -20),   // Model 3: Flask
  new THREE.Vector3(0, 30, -40),    // Model 4: Radar dish
  new THREE.Vector3(40, -20, -30),  // Model 5: Hologram card
]);

export const CinematicScene = ({ 
  scrollContainer, 
  isDashboardMode = false, 
  activeTab = 'experiments' 
}: { 
  scrollContainer: React.RefObject<HTMLDivElement | null>,
  isDashboardMode?: boolean,
  activeTab?: string
}) => {
  const { camera, scene } = useThree();
  const lookTarget = useRef(new THREE.Vector3(3, 0, 0));
  
  // Array tracking which models have been instructed to load
  const [activeModels, setActiveModels] = useState<number[]>([0, 1]);

  useEffect(() => {
    if (!scrollContainer.current) return;

    // RULE: If in dashboard mode, we lock camera to the specific chapter waypoint
    if (isDashboardMode) {
      const tabToT: Record<string, number> = {
        'experiments': 0.25,
        'train': 0.5,
        'hpo': 0.75,
        'models': 1.0
      };
      
      const t = tabToT[activeTab] ?? 0.25;
      const point = cameraPath.getPoint(t);
      const look = lookPath.getPoint(t);

      gsap.to(camera.position, { 
        x: point.x, y: point.y, z: point.z, 
        duration: 1.2, 
        ease: 'power3.inOut',
      });

      gsap.to(lookTarget.current, {
        x: look.x, y: look.y, z: look.z,
        duration: 1.2,
        ease: 'power3.inOut'
      });
      
      // Ensure the model for this section is active
      const section = Math.floor(t * 4.0);
      setActiveModels(prev => prev.includes(section) ? prev : [...prev, section]);

      return; // Do not register ScrollTrigger in dashboard mode
    }

    // NORMAL CINEMATIC SCROLL MODE
    const startPos = cameraPath.getPoint(0);
    // Only snap if not already near a point (to avoid jumping on return from dashboard)
    // Actually, snapping is fine for the start state.
    
    const st = ScrollTrigger.create({
      trigger: scrollContainer.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const totalScrollable = 550; 
        const targetScroll = 480; 
        let t = (self.progress * totalScrollable) / targetScroll;
        t = Math.min(1.0, Math.max(0.0, t));

        const point = cameraPath.getPoint(t);
        const look = lookPath.getPoint(t);
        
        gsap.to(camera.position, { 
          x: point.x, y: point.y, z: point.z, 
          duration: 0.8, 
          ease: 'power2.out',
        });

        gsap.to(lookTarget.current, {
          x: look.x, y: look.y, z: look.z,
          duration: 0.8,
          ease: 'power2.out'
        });

        let currentSection = Math.floor(t * 4.0);
        if (currentSection > 4) currentSection = 4;
        
        setActiveModels(prev => {
          if (!prev.includes(currentSection + 1) && currentSection + 1 < 5) {
            return [...prev, currentSection + 1];
          }
          return prev;
        });
      }
    });

    scene.fog = new THREE.FogExp2('#050505', 0.04);

    return () => {
      st.kill();
      scene.fog = null;
    };
  }, [camera, scrollContainer, scene, isDashboardMode, activeTab]);

  useFrame(() => {
    camera.lookAt(lookTarget.current);
  });

  return (
    <>
      <color attach="background" args={['#050505']} />
      
      {/* Cosmos Atmosphere */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.5} fade speed={1} />
      
      {/* HDR Environment — no ground plane */}
      <Environment files="/hdri/studio_small_08.hdr" background={false} ground={undefined} />
      
      {/* Sequentially Mounted 1-section-ahead Models */}
      <Suspense fallback={null}>
        {activeModels.includes(0) && <NeuralHub position={[3, 0, 0]} scale={[3, 3, 3]} />}
      </Suspense>
      <Suspense fallback={null}>
        {activeModels.includes(1) && <GPURack position={[100, -3, 3] as any} />}
      </Suspense>
      <Suspense fallback={null}>
        {activeModels.includes(2) && <ExperimentFlask position={[-30, 0, -20] as any} />}
      </Suspense>
      <Suspense fallback={null}>
        {activeModels.includes(3) && <RadarDish position={[0, 30, -40] as any} />}
      </Suspense>
      <Suspense fallback={null}>
        {activeModels.includes(4) && <AssetHologram position={[43.5, -20, -30]} />}
      </Suspense>
      
      {/* Cinematic Post-Processing Pipeline */}
      <EffectComposer>
        <Bloom 
          luminanceThreshold={1.0} 
          luminanceSmoothing={0.5} 
          intensity={1.5} 
          mipmapBlur
        />
        <DepthOfField 
          focusDistance={0.0} 
          focalLength={0.02} 
          bokehScale={2} 
          height={480} 
        />
        <Noise opacity={0.04} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <ChromaticAberration 
          blendFunction={BlendFunction.NORMAL} 
          offset={new THREE.Vector2(0.0005, 0.0005)} 
        />
      </EffectComposer>
    </>
  );
};
