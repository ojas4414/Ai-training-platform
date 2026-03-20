import { useEffect, useRef, useState } from 'react';
import { m, useMotionValue, useSpring } from 'motion/react';
import styles from './CustomCursor.module.css';

interface MousePos {
  x: number;
  y: number;
}

interface MagneticTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: string;
}

interface TrailParticle {
  id: number;
  x: number;
  y: number;
}

export function CustomCursor() {
  const [mousePos, setMousePos] = useState<MousePos>({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [magneticTarget, setMagneticTarget] = useState<MagneticTarget | null>(null);
  
  const trailRef = useRef<TrailParticle[]>([]);
  const [trail, setTrail] = useState<TrailParticle[]>([]);

  // Spring animations for magnetic snap
  const springConfig = { stiffness: 250, damping: 25, mass: 0.5 };
  const cursorX = useSpring(useMotionValue(0), springConfig);
  const cursorY = useSpring(useMotionValue(0), springConfig);
  const cursorWidth = useSpring(useMotionValue(12), springConfig);
  const cursorHeight = useSpring(useMotionValue(12), springConfig);
  const cursorRadius = useSpring(useMotionValue(50), springConfig); // % or px? we'll use px

  useEffect(() => {
    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Find nearest magnetic target
      const targets = document.querySelectorAll('button, a, [role="button"], .interactive');
      let foundNearest: MagneticTarget | null = null;
      let foundNearestEl: HTMLElement | null = null;
      let minDistance = 65; // Threshold for snapping

      // Use a standard for loop to avoid scope/inference issues with forEach in some TS versions
      for (let i = 0; i < targets.length; i++) {
        const el = targets[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);

        if (distance < minDistance) {
          minDistance = distance;
          const style = window.getComputedStyle(el);
          foundNearest = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: style.borderRadius,
          };
          foundNearestEl = el;
        } else {
          // Clear variables from non-nearest elements
          el.style.setProperty('--mx', '0px');
          el.style.setProperty('--my', '0px');
        }
      }

      setMagneticTarget(foundNearest);

      // Update springs & CSS variables for bulge
      if (foundNearest && foundNearestEl) {
        const target = foundNearest as MagneticTarget;
        cursorX.set(target.x);
        cursorY.set(target.y);
        cursorWidth.set(target.width);
        cursorHeight.set(target.height);
        cursorRadius.set(parseInt(target.borderRadius) || 8);

        // Calculate relative mouse position for bulge (-0.5 to 0.5 range)
        const rect = foundNearestEl.getBoundingClientRect();
        const rx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const ry = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        
        foundNearestEl.style.setProperty('--mx', `${rx * 12}px`);
        foundNearestEl.style.setProperty('--my', `${ry * 12}px`);
      } else {
        cursorX.set(e.clientX - 6);
        cursorY.set(e.clientY - 6);
        cursorWidth.set(12);
        cursorHeight.set(12);
        cursorRadius.set(50);
      }

      // Add trail particle on click
      if (isClicking) {
        const newParticle: TrailParticle = {
          id: Date.now() + Math.random(),
          x: e.clientX,
          y: e.clientY,
        };
        trailRef.current.push(newParticle);
        setTrail([...trailRef.current]);

        // Remove after animation
        setTimeout(() => {
          trailRef.current = trailRef.current.filter(p => p.id !== newParticle.id);
        }, 600);
      }

      // Keep only last 10 particles
      if (trailRef.current.length > 10) {
        trailRef.current.shift();
      }
    };

    // Detect hover on interactive elements
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute('role') === 'button' ||
        target.tagName === 'INPUT' ||
        target.classList.contains('interactive');
      if (isInteractive) setIsHovering(true);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute('role') === 'button' ||
        target.tagName === 'INPUT' ||
        target.classList.contains('interactive');
      if (isInteractive) setIsHovering(false);
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Add hover detection to interactive elements
    document.querySelectorAll('button, a, [role="button"], input, .interactive').forEach(el => {
      el.addEventListener('mouseenter', handleMouseEnter as EventListener);
      el.addEventListener('mouseleave', handleMouseLeave as EventListener);
    });

    // Hide system cursor
    const style = document.createElement('style');
    style.textContent = '* { cursor: none !important; }';
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.head.removeChild(style);
    };
  }, [isClicking]);

  return (
    <>
      {/* Main Cursor Outer Ring */}
      <m.div
        className={`${styles.cursorOuter} ${magneticTarget ? styles.magnetic : ''}`}
        style={{
          x: cursorX,
          y: cursorY,
          width: cursorWidth,
          height: cursorHeight,
          borderRadius: magneticTarget ? undefined : '50%', // fallback for dot mode
        }}
        animate={{
          scale: isClicking ? 0.9 : 1,
          opacity: 0.8,
          borderColor: magneticTarget ? 'rgba(216, 179, 106, 0.4)' : 'rgba(216, 179, 106, 0.6)',
        }}
      />

      {/* Inner Dot */}
      <m.div
        className={styles.cursorInner}
        animate={{
          x: mousePos.x - 2,
          y: mousePos.y - 2,
          scale: isHovering ? 0.5 : 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />

      {/* Trail Particles */}
      {trail.map((particle) => (
        <m.div
          key={particle.id}
          className={styles.trailParticle}
          initial={{ opacity: 1, scale: 1 }}
          animate={{
            opacity: 0,
            scale: 0,
            x: particle.x - 3,
            y: particle.y - 3,
          }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </>
  );
}
