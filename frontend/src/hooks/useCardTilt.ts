import { useEffect, useRef, useState } from 'react';

interface TiltOptions {
  scale?: number;
  speed?: number;
  max?: number;
}

interface TiltState {
  x: number;
  y: number;
}

interface ShadowOffset {
  x: number;
  y: number;
}

export function useCardTilt(options: TiltOptions = {}) {
  const {
    scale = 1.05,
    speed = 500,
    max = 8,
  } = options;

  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>({ x: 0, y: 0 });
  const [shadowOffset, setShadowOffset] = useState<ShadowOffset>({ x: 0, y: 0 });

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt angles (-max to +max degrees)
      const tiltX = ((y - centerY) / centerY) * max;
      const tiltY = -((x - centerX) / centerX) * max;

      setTilt({ x: tiltX, y: tiltY });
      setShadowOffset({ x: -tiltY * 2, y: -tiltX * 2 });
    };

    const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
      setShadowOffset({ x: 0, y: 0 });
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [max]);

  const getTransform = () => ({
    transform: `
      perspective(1000px)
      rotateX(${tilt.x}deg)
      rotateY(${tilt.y}deg)
      scale(${scale})
    `,
    boxShadow: `
      ${shadowOffset.x}px ${shadowOffset.y}px 30px rgba(0,0,0,0.2),
      inset ${-shadowOffset.x}px ${-shadowOffset.y}px 20px rgba(255,255,255,0.1)
    `,
    transition: `all ${speed}ms cubic-bezier(0.23, 1, 0.320, 1)`,
  });

  return { cardRef, getTransform };
}
