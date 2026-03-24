import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const AssetHologram = ({ position }: { position: [number, number, number] }) => {
  const cardGroup = useRef<THREE.Group>(null);
  const wafersRef = useRef<THREE.InstancedMesh>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  
  const selectedHash = useRef('0x8F9E2A1B');
  const renderCount = useRef(0);

  // Dark semi-transparent iridescent card material
  const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d1117',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.1,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 800],
    envMapIntensity: 2.5,
    transparent: true,
    opacity: 0.85,
  }), []);

  // Dark teal semi-transparent hexagon wafer material
  const waferMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1D9E75',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.05,
    thickness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 800],
    envMapIntensity: 2.0,
    transparent: true,
    opacity: 0.5,
  }), []);

  const waferCount = 8;
  const wafersData = useMemo(() => {
    return Array.from({ length: waferCount }).map(() => ({
      radius: 1.8 + Math.random() * 2.0,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * 1.5,
      yOffset: (Math.random() - 0.5) * 3.0,
      rotX: Math.random() * Math.PI,
      rotY: Math.random() * Math.PI,
      scale: (0.5 + Math.random() * 0.5) * 0.3
    }));
  }, []);

  const tempObj = useMemo(() => new THREE.Object3D(), []);

  const drawCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear transparent
    ctx.clearRect(0, 0, 512, 768);
    
    // Dark glass backing
    ctx.fillStyle = 'rgba(8, 12, 20, 0.6)';
    ctx.fillRect(0, 0, 512, 768);
    
    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<512; i+=32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 768); ctx.stroke();
    }
    for(let i=0; i<768; i+=32) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    
    // Filename Header
    ctx.fillStyle = '#1D9E75';
    ctx.font = 'bold 32px JetBrains Mono';
    ctx.fillText('RESNET-50-OPT', 40, 80);
    
    // Metrics Grid
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '20px sans-serif';
    ctx.fillText('Accuracy: 98.4%', 40, 140);
    ctx.fillText('Latency: 12ms', 40, 180);
    ctx.fillText('Size: 45MB', 40, 220);
    
    // Loss Curve Mock
    ctx.strokeStyle = '#EF9F27';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 400);
    ctx.bezierCurveTo(200, 380, 200, 300, 470, 280);
    ctx.stroke();

    // Checkpoint Selection feedback
    ctx.fillStyle = 'rgba(29, 158, 117, 0.15)';
    ctx.fillRect(40, 500, 432, 200);
    
    ctx.fillStyle = '#1D9E75';
    ctx.font = '16px monospace';
    ctx.fillText('STATUS: SECURE_LINK_ACTIVE', 60, 540);
    ctx.fillText(`HASH: ${selectedHash.current}`, 60, 580);
    ctx.fillText(`RENDERS: ${renderCount.current}`, 60, 620);

    // Rule: texture.needsUpdate = true fires every time canvas is redrawn
    if (textureRef.current) textureRef.current.needsUpdate = true;
    renderCount.current++;
  };

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = 512;
    canvasRef.current.height = 768;
    textureRef.current = new THREE.CanvasTexture(canvasRef.current);
    
    drawCanvas();
    
    // Rule: window event listener fires correctly when a checkpoint row is selected
    const handleSelection = (e: any) => {
        if(e.detail && e.detail.hash) {
            selectedHash.current = e.detail.hash;
            drawCanvas();
        }
    };
    window.addEventListener('checkpointSelected', handleSelection);
    return () => {
        window.removeEventListener('checkpointSelected', handleSelection);
        textureRef.current?.dispose();
    };
  }, []);

  const { pointer } = useThree();
  const targetRotation = useRef(new THREE.Vector2(0, 0));

  useFrame((state, delta) => {
    // Mouse spring rotation works — card tilts toward cursor
    // pointer.x/y is normalized -1 to 1
    targetRotation.current.x = (pointer.y) * 0.4;
    targetRotation.current.y = (pointer.x) * 0.4;
    
    if (cardGroup.current) {
        // Spring easing
        cardGroup.current.rotation.x = THREE.MathUtils.lerp(cardGroup.current.rotation.x, targetRotation.current.x, delta * 5.0);
        cardGroup.current.rotation.y = THREE.MathUtils.lerp(cardGroup.current.rotation.y, targetRotation.current.y, delta * 5.0);
        
        // Gentle float
        cardGroup.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
    
    // Orbiting hexagonal wafers
    if (wafersRef.current) {
        wafersData.forEach((w, i) => {
            w.angle += w.speed * delta;
            w.rotX += delta * 0.5;
            w.rotY += delta * 0.8;
            
            tempObj.position.set(Math.cos(w.angle) * w.radius, w.yOffset, Math.sin(w.angle) * w.radius);
            tempObj.rotation.set(w.rotX, w.rotY, 0);
            tempObj.scale.setScalar(w.scale);
            tempObj.updateMatrix();
            wafersRef.current!.setMatrixAt(i, tempObj.matrix);
        });
        wafersRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
       {/* Ensure card container */}
       <group ref={cardGroup}>
          <mesh material={glassMaterial}>
             <boxGeometry args={[2.0, 3.0, 0.05]} />
          </mesh>
          {textureRef.current && (
            <mesh position={[0, 0, 0.026]}>
              <planeGeometry args={[1.9, 2.9]} />
              <meshBasicMaterial map={textureRef.current} transparent opacity={1} side={THREE.DoubleSide} />
            </mesh>
          )}
       </group>
       
       {/* 8 hexagonal wafers orbit at varying radii and speeds */}
       <instancedMesh ref={wafersRef} args={[undefined, undefined, waferCount]} material={waferMaterial}>
          {/* Hexagon is a cylinder with 6 radial segments */}
          <cylinderGeometry args={[0.2, 0.2, 0.05, 6]} /> 
       </instancedMesh>
    </group>
  );
};
