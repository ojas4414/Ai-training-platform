import { m } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';
import styles from './StatRing.module.css';

interface StatRingProps {
  percentage: number;
  label: string;
  icon?: string | React.ReactNode;
  color?: 'accent' | 'secondary' | 'success' | 'danger';
}

export const StatRing = ({ 
  percentage, 
  label, 
  icon,
  color = 'accent'
}: StatRingProps) => {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  const colorMap = {
    accent: { stroke: 'var(--accent-primary)', glow: 'var(--glow-accent)' },
    secondary: { stroke: 'var(--accent-secondary)', glow: 'var(--glow-secondary)' },
    success: { stroke: 'var(--accent-success)', glow: 'var(--glow-success)' },
    danger: { stroke: 'var(--accent-danger)', glow: 'var(--glow-danger)' },
  };

  return (
    <m.div 
      className={styles.container}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <svg width="120" height="120" className={styles.ring}>
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="transparent"
          stroke="var(--border-medium)"
          strokeWidth="8"
        />
        <m.circle
          cx="60"
          cy="60"
          r="45"
          fill="transparent"
          stroke={colorMap[color].stroke}
          strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          strokeLinecap="round"
        />
        <defs>
          <filter id={`glow-${color}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className={styles.content}>
        {icon && (
          <span className={styles.icon}>
            {typeof icon === 'string' ? icon : icon}
          </span>
        )}
        <m.div 
          className={styles.percentage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatedNumber value={Math.round(percentage)} />%
        </m.div>
        <p className={styles.label}>{label}</p>
      </div>
    </m.div>
  );
};
