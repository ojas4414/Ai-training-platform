import { useEffect } from 'react';

export const useMagnetic = () => {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const magnetics = document.querySelectorAll('button, a, .interactive');
      
      magnetics.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;
        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
        
        const limit = 60; // Decreased activation radius for subtle feel
        if (distance < limit) {
          const power = 0.2; // Weakened magnetism
          const x = distanceX * power;
          const y = distanceY * power;
          
          (el as HTMLElement).style.setProperty('--mx', `${x}px`);
          (el as HTMLElement).style.setProperty('--my', `${y}px`);
          
          // Removed scale effect for a purely positional pull
          (el as HTMLElement).style.transform = `translate(${x}px, ${y}px)`;
        } else {
          (el as HTMLElement).style.setProperty('--mx', '0px');
          (el as HTMLElement).style.setProperty('--my', '0px');
          (el as HTMLElement).style.transform = `translate(0px, 0px) scale(1)`;
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
};
