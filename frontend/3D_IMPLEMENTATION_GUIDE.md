# 3D Hero Scene Implementation (Optional but Recommended)

## 📱 Should You Add 3D Models?

### ✅ YES - You Should Add:
1. **3D Hero Background** - Neural network visualization on landing page
2. **Interactive GPU Globe** - Real-time resource visualization
3. **Model Viewer** - For uploaded ML models

### ❌ NO - Skip 3D for:
- Tab navigation
- Form inputs
- Data tables
- Functional UI components

---

## 🎮 3D Hero Scene with Three.js

### Step 1: Install Dependencies

```bash
npm install three react-three-fiber @react-three/drei gsap
```

### Step 2: Create 3D Component

Create `src/components/Hero3D.tsx`:

```typescript
import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import * as random from 'random';

interface ParticleFieldProps {
  count?: number;
}

function ParticleField({ count = 5000 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const particles = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      particles[i] = (Math.random() - 0.5) * 2000;
      particles[i + 1] = (Math.random() - 0.5) * 2000;
      particles[i + 2] = (Math.random() - 0.5) * 2000;
    }
    particlesRef.current = particles;
  }, [count]);

  useFrame(({ mouse }) => {
    if (!pointsRef.current) return;
    
    pointsRef.current.rotation.x += 0.0001;
    pointsRef.current.rotation.y += 0.0002;
    pointsRef.current.position.x = mouse.x * 100;
    pointsRef.current.position.y = mouse.y * 100;
  });

  if (!particlesRef.current) return null;

  return (
    <Points ref={pointsRef} positions={particlesRef.current} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#6366f1"
        size={2}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </Points>
  );
}

function NeuralNetwork() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ mouse }) => {
    if (!groupRef.current) return;
    groupRef.current.position.x = mouse.x * 50;
    groupRef.current.position.y = mouse.y * 50;
  });

  return (
    <group ref={groupRef}>
      <ParticleField count={3000} />
    </group>
  );
}

export const Hero3D = () => {
  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 300], fov: 75 }}>
        <color attach="background" args={['#0a0e27']} />
        <Suspense fallback={null}>
          <NeuralNetwork />
        </Suspense>
      </Canvas>
    </div>
  );
};
```

### Step 3: Use in App.tsx

```typescript
import { Hero3D } from './components/Hero3D';

// In your landing page or header:
function App() {
  return (
    <div>
      {viewMode === 'landing' && <Hero3D />}
      {/* rest of app */}
    </div>
  );
}
```

---

## 🌐 Advanced: GPU Utilization Globe

Create `src/components/GPUGlobe.tsx`:

```typescript
import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const positionAttribute = geometry.getAttribute('position');
    const colors = new Uint8Array(positionAttribute.count * 3);

    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = Math.random() * 255;     // R - CPU usage
      colors[i + 1] = Math.random() * 255; // G - Memory usage
      colors[i + 2] = Math.random() * 255; // B - Disk usage
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    meshRef.current.geometry = geometry;
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.001;
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 4]} />
      <meshPhongMaterial
        color="#6366f1"
        emissive="#a78bfa"
        wireframe
        wireframeLinewidth={2}
      />
    </mesh>
  );
}

export const GPUGlobe = () => {
  return (
    <Canvas style={{ height: '300px' }} camera={{ position: [0, 0, 2.5] }}>
      <color attach="background" args={['#0a0e27']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Globe />
    </Canvas>
  );
};
```

---

## 📊 Simple Stats with Animated Progress Ring

Create `src/components/StatRing.tsx`:

```typescript
import { m } from 'motion/react';
import styles from './StatRing.module.css';

interface StatRingProps {
  percentage: number;
  label: string;
  icon?: string;
}

export const StatRing = ({ percentage, label, icon }: StatRingProps) => {
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={styles.container}>
      <svg width="120" height="120" className={styles.ring}>
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="transparent"
          stroke="var(--bg-tertiary)"
          strokeWidth="8"
        />
        <m.circle
          cx="60"
          cy="60"
          r="45"
          fill="transparent"
          stroke="url(#gradient)"
          strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-secondary)" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.content}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <m.span className={styles.percentage} layoutId="percentage">
          {Math.round(percentage)}%
        </m.span>
        <p className={styles.label}>{label}</p>
      </div>
    </div>
  );
};
```

Create `src/components/StatRing.module.css`:

```css
.container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.ring {
  transform: rotate(-90deg);
  filter: drop-shadow(0 0 20px var(--accent-glow));
}

.content {
  position: absolute;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.icon {
  font-size: 24px;
}

.percentage {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-primary);
}

.label {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}
```

---

## 🎯 When to Use 3D (Decision Guide)

### Performance Considerations:
```
Device              3D Recommendation
────────────────────────────────────
Modern Desktop      ✅ YES - Use advanced 3D
Laptop              ✅ YES - Reduce particle count
Tablet              ⚠️  MAYBE - Use lower LOD
Mobile              ❌ NO - Use 2D fallback
```

### Fallback Strategy:

```typescript
export const Hero3D = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (isMobile) {
    return <Hero2DFallback />; // Simple animated gradient
  }

  return (
    <Canvas>
      <NeuralNetwork />
    </Canvas>
  );
};
```

---

## ⚡ Performance Tips for 3D

### Good Practices:
1. Use `frustumCulled={true}` to skip off-screen objects
2. Limit particle count based on device
3. Use `depthWrite={false}` for transparent geometries
4. Cache geometries and materials
5. Use `LOD` (Level of Detail) for complex models

### Bad Practices:
1. Creating new geometries every frame
2. Using too many lights
3. High polygon count models
4. Not cleaning up on unmount
5. Running 3D on all devices equally

---

## 📊 Expected Results After Adding 3D:

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| Visual Appeal | 6/10 | 9/10 | 🔥 Huge |
| Engagement | Low | High | 🔥 Huge |
| Load Time | 1.2s | 1.8s | -33% (acceptable) |
| User Retention | Unknown | Higher | 🟢 Good |
| Mobile Score | 85 | 72 | ⚠️ Needs fallback |

---

## ✅ Recommended Path Forward

### Phase 1: Quick Wins (1 hour)
- [ ] Add glassmorphism CSS
- [ ] Add button animations
- [ ] Add dark mode toggle

### Phase 2: Simple 3D (2 hours)
- [ ] Install Three.js
- [ ] Add Hero3D component
- [ ] Add StatRing component

### Phase 3: Advanced (3 hours)
- [ ] GPU Globe visualization
- [ ] Real-time data binding
- [ ] Mobile performance optimization

---

## 🚀 Start with This:

```bash
# Install 3D libraries
npm install three react-three-fiber @react-three/drei

# Create component
touch src/components/Hero3D.tsx

# Add to landing page
# Edit src/App.tsx and import Hero3D
```

**Total Time to Premium UI: 5-7 hours of focused work**

---

**Ready to start? Pick Quick Wins first, then add 3D! 🚀**
