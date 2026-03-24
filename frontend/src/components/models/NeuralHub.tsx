import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const NeuralHub = ({ position, ...rest }: { position: [number, number, number] } & Record<string, any>) => {
  const group = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // 120 nodes evenly distributed (Fibonacci sphere)
  const NODE_COUNT = 120;
  
  const { nodes, lineGeo } = useMemo(() => {
    const pts = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i; // golden angle increment
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      pts.push(new THREE.Vector3(x * 2.0, y * 2.0, z * 2.0));
    }
    
    // Create edges (connect each node to its 4 nearest neighbors)
    const linePts = [];
    const adj = Array.from({ length: NODE_COUNT }, () => [] as number[]);
    
    for (let i = 0; i < NODE_COUNT; i++) {
      const distances = [];
      for(let j=0; j < NODE_COUNT; j++){
         if(i===j) continue;
         distances.push({ index: j, dist: pts[i].distanceTo(pts[j]) });
      }
      distances.sort((a,b) => a.dist - b.dist);
      // Connect to 4 nearest
      for(let k=0; k<4; k++) {
         const target = distances[k].index;
         // Avoid double lines
         if(!adj[i].includes(target)) {
             adj[i].push(target);
             adj[target].push(i);
             linePts.push(pts[i], pts[target]);
         }
      }
    }
    
    return { nodes: pts, lineGeo: new THREE.BufferGeometry().setFromPoints(linePts) };
  }, []);

  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const pulseState = useRef({ activeNode: 0, distance: 0, time: 0 });
  const mousePos = useRef(new THREE.Vector3());
  const { viewport } = useThree();

  useFrame((state, delta) => {
    if(!group.current || !instancedMeshRef.current) return;
    
    // Tilted 15 degrees on Z axis - never perfectly upright
    group.current.rotation.z = THREE.MathUtils.degToRad(15);
    // Slow rotation
    group.current.rotation.y += delta * 0.1;

    // Track mouse in 3D space rough approximation
    mousePos.current.set(
       (state.pointer.x * viewport.width) / 2,
       (state.pointer.y * viewport.height) / 2,
       2.0 // assume surface depth
    );

    // Update pulse
    pulseState.current.time += delta * 3.0; // speed of pulse
    if(pulseState.current.time > 1.0) {
        pulseState.current.time = 0;
        pulseState.current.distance += 1.0;
        // Reset pulse after spreading distance of 5
        if(pulseState.current.distance > 5) {
           pulseState.current.distance = 0;
           pulseState.current.activeNode = Math.floor(Math.random() * NODE_COUNT);
        }
    }

    const worldMouse = mousePos.current.clone();
    group.current.worldToLocal(worldMouse);

    for(let i=0; i<NODE_COUNT; i++) {
       const basePos = nodes[i];
       
       // Mouse proximity push
       const distToMouse = basePos.distanceTo(worldMouse);
       const pushFactor = Math.max(0, 1.0 - (distToMouse / 2.0)) * 0.3; // 0.3 depth push
       
       // Push out along normal
       const pushedPos = basePos.clone().add(basePos.clone().normalize().multiplyScalar(pushFactor));
       
       // Pulse logic
       const distToActive = basePos.distanceTo(nodes[pulseState.current.activeNode]);
       // Activate if within the traveling wavefront
       const isPulseWave = Math.abs(distToActive - pulseState.current.distance) < 0.8;
       
       const scale = 1.0 + (isPulseWave ? Math.sin(pulseState.current.time * Math.PI) * 0.8 : 0);
       
       tempObject.position.copy(pushedPos);
       tempObject.scale.setScalar(scale);
       tempObject.updateMatrix();
       instancedMeshRef.current.setMatrixAt(i, tempObject.matrix);
       
       const colorBase = new THREE.Color('#1d9e75');
       if(isPulseWave) {
           // mix with white core
           colorBase.lerp(new THREE.Color('#ffffff'), Math.sin(pulseState.current.time * Math.PI));
       }
       instancedMeshRef.current.setColorAt(i, colorBase);
    }
    
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    if(instancedMeshRef.current.instanceColor) instancedMeshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group} position={position} {...rest}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#1d9e75" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, NODE_COUNT]}>
        <icosahedronGeometry args={[0.04, 0]} />
        <meshStandardMaterial 
          color="#1d9e75" 
          emissive="#1d9e75" 
          emissiveIntensity={3.0} 
          roughness={0.2} 
          metalness={0.8} 
        />
      </instancedMesh>
    </group>
  );
};
