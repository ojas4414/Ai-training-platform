import { useEffect, useState } from 'react';
import { m, useSpring } from 'framer-motion';

export const CustomCursor = () => {
  const [active, setActive] = useState(false);
  const mouseX = useSpring(0, { stiffness: 500, damping: 28 });
  const mouseY = useSpring(0, { stiffness: 500, damping: 28 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      
      const target = e.target as HTMLElement;
      setActive(!!target?.closest('button, a, .interactive'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <m.div 
      className="custom-cursor"
      style={{
        x: mouseX,
        y: mouseY,
        scale: active ? 1.5 : 1,
        backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'white'
      }}
    />
  );
};
