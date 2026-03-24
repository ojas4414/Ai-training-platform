import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const ExperimentFlask = ({ position }: { position: [number, number, number] }) => {
  const group = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  
  const lathePoints = useMemo(() => {
    return [
      new THREE.Vector2(0.3, 1.5),  // top neck
      new THREE.Vector2(0.3, 0.2),  // neck base
      new THREE.Vector2(1.2, -1.0), // bottom bowl
      new THREE.Vector2(1.2, -1.2), // bottom corner
      new THREE.Vector2(0.3, -1.2), // hole for 4 streams
      new THREE.Vector2(0.3, -2.0)  // pipe down
    ];
  }, []);

  const particleCount = 200; // 120 grey/teal + 80 amber computation
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particleData = useMemo(() => {
    const data = [];
    for(let i=0; i<particleCount; i++){
      data.push({
        yPos: Math.random() * 4.0 - 2.0, 
        xOffset: (Math.random() - 0.5) * 2.0,
        zOffset: (Math.random() - 0.5) * 2.0,
        speed: Math.random() * 0.4 + 0.2,
        isComputation: i < 80 // First 80 are Amber Computation Zone
      });
    }
    return data;
  }, []);

  // For connecting amber particles
  const lineGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame((_, delta) => {
    if(group.current) {
        group.current.rotation.y += delta * 0.1;
    }
    
    if(particlesRef.current) {
        const amberPositions = [];
        
        for(let i=0; i<particleCount; i++){
            const p = particleData[i];
            
            if (p.isComputation) {
                // Amber particles hover in the computation zone (0.0 to -0.8)
                // Use sine waves to make them swirl
                p.yPos += Math.sin(Date.now() * 0.001 + i) * delta * 0.2;
                if(p.yPos > 0.0) p.yPos = 0.0;
                if(p.yPos < -0.8) p.yPos = -0.8;
                
                const radiusMult = 0.6; // fit securely inside flask
                const x = Math.sin(Date.now() * 0.0005 + i) * radiusMult;
                const z = Math.cos(Date.now() * 0.0007 + i) * radiusMult;
                
                dummy.position.set(x, p.yPos, z);
                amberPositions.push(dummy.position.clone());
            } else {
                // Grey chaos falling to Teal output
                p.yPos -= delta * p.speed * 1.5;
                if(p.yPos < -2.5) p.yPos = 2.5;
                
                let radiusMult = 1.0;
                let streamIndex = i % 4; // 4 exit streams
                
                if(p.yPos > 0.2) {
                   // Entry neck
                   radiusMult = 0.2;
                } else if(p.yPos <= 0.2 && p.yPos > -1.0) {
                   // Spreading bowl, but avoid amber core
                   const t = Math.pow((0.2 - p.yPos) / 1.2, 0.8); 
                   radiusMult = 0.4 + t * 0.6; // flowing walls
                } else if (p.yPos <= -1.0) {
                   // 4 tight output streams below flask
                   radiusMult = 0.02; 
                }
                
                let x = p.xOffset * radiusMult;
                let z = p.zOffset * radiusMult;
                
                if (p.yPos <= -1.0) {
                   // separate into 4 distinct streams below the base
                   const offsetStream = 0.15;
                   if (streamIndex === 0) { x += offsetStream; z += offsetStream; }
                   if (streamIndex === 1) { x -= offsetStream; z += offsetStream; }
                   if (streamIndex === 2) { x += offsetStream; z -= offsetStream; }
                   if (streamIndex === 3) { x -= offsetStream; z -= offsetStream; }
                }
                
                dummy.position.set(x, p.yPos, z);
            }
            
            dummy.updateMatrix();
            particlesRef.current.setMatrixAt(i, dummy.matrix);
            
            let colorHex = '#888780'; // Grey chaos
            if(p.isComputation) {
               colorHex = '#EF9F27'; // Amber computation
            } else if(p.yPos <= -1.0) {
               colorHex = '#1D9E75'; // Teal result
            }
            particlesRef.current.setColorAt(i, new THREE.Color(colorHex));
        }
        
        // Build lines for amber particles
        const linePts = [];
        for(let a=0; a<amberPositions.length; a++){
            for(let b=a+1; b<amberPositions.length; b++){
                if(amberPositions[a].distanceTo(amberPositions[b]) < 0.35) {
                    linePts.push(amberPositions[a], amberPositions[b]);
                }
            }
        }
        lineGeo.setFromPoints(linePts);
        
        particlesRef.current.instanceMatrix.needsUpdate = true;
        if(particlesRef.current.instanceColor) particlesRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group ref={group} position={position}>
      {/* Physically Correct Glass Body */}
      <mesh>
        <latheGeometry args={[lathePoints, 64]} />
        <meshPhysicalMaterial 
          transmission={0.98} 
          thickness={0.5} 
          roughness={0.05} 
          opacity={1}
          color="#ffffff"
          transparent
        />
      </mesh>
      
      {/* Amber Computation Connections */}
      <lineSegments geometry={lineGeo}>
         <lineBasicMaterial color="#EF9F27" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      
      {/* Computations Stream */}
      <instancedMesh ref={particlesRef} args={[undefined, undefined, particleCount]}>
        <icosahedronGeometry args={[0.02, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
