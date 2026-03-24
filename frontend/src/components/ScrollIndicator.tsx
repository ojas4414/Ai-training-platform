import { useState, useEffect } from 'react';

export const ScrollIndicator = () => {
  const [scroll, setScroll] = useState(0);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const dashboardMain = document.querySelector('.main-content');
      if (dashboardMain) {
        const percent = dashboardMain.scrollTop / (dashboardMain.scrollHeight - dashboardMain.clientHeight);
        setScroll(isNaN(percent) ? 0 : percent);
      } else {
        const h = document.documentElement;
        const b = document.body;
        const percent = (h.scrollTop || b.scrollTop) / ((h.scrollHeight || b.scrollHeight) - h.clientHeight);
        setScroll(isNaN(percent) ? 0 : percent);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth - e.clientX < 80) {
        setIsNear(true);
      } else {
        setIsNear(false);
      }
    };

    window.addEventListener('scroll', handleScroll, true); // Catch bubble from main-content
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);


  const thumbHeight = 40; // px
  const top = scroll * (window.innerHeight - thumbHeight);

  return (
    <div 
      className="scroll-tracker" 
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '60px',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div 
        className="scroll-thumb"
        style={{
          position: 'absolute',
          right: '8px',
          top: `${top}px`,
          width: '4px',
          height: `${thumbHeight}px`,
          background: 'rgba(255, 255, 255, 0.4)',
          borderRadius: '4px',
          transform: `translateX(${isNear ? '0' : '20px'})`,
          opacity: isNear ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s',
          pointerEvents: 'auto'
        }}
      />
    </div>
  );
};
