import React from 'react';

export const MetricCard = ({ title, value, valueColor }: { title: string, value: React.ReactNode, valueColor: string }) => {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div 
      className="metric-card card" 
      onMouseMove={handleMouseMove}
      style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '64px', fontWeight: 300, lineHeight: 1, color: valueColor, fontFamily: '"Space Grotesk", sans-serif' }}>{value}</div>
    </div>
  );
};
