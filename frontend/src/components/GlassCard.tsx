import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { useCardTilt } from '../hooks/useCardTilt';
import styles from './GlassCard.module.css';

interface GlassCardProps {
  children: ReactNode;
  hoverable?: boolean;
  glow?: 'accent' | 'secondary' | 'success' | 'danger' | 'none';
  className?: string;
  tilt?: boolean;
}

export const GlassCard = ({ 
  children, 
  hoverable = true,
  glow = 'accent',
  className = '',
  tilt = true,
}: GlassCardProps) => {
  const { cardRef, getTransform } = useCardTilt({
    scale: 1.03,
    max: 6,
  });

  return (
    <m.div
      ref={cardRef}
      className={`${styles.glassCard} ${styles[`glow-${glow}`]} ${hoverable ? styles.hoverable : ''} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable && !tilt ? { scale: 1.02, y: -4 } : {}}
      transition={{ duration: 0.3 }}
      style={tilt && hoverable ? (getTransform() as React.CSSProperties) : undefined}
    >
      {children}
    </m.div>
  );
};
