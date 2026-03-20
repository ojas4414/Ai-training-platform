import { m } from 'motion/react';
import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  count?: number;
  variant?: 'lines' | 'cards' | 'avatar';
  height?: string;
}

export const SkeletonLoader = ({ 
  count = 3,
  variant = 'lines',
  height = '12px'
}: SkeletonLoaderProps) => {
  if (variant === 'cards') {
    return (
      <div className={styles.cardsContainer}>
        {Array.from({ length: count }).map((_, i) => (
          <m.div
            key={i}
            className={styles.skeletonCard}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonLine} style={{ width: '70%' }} />
            <div className={styles.skeletonLine} style={{ width: '50%' }} />
          </m.div>
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <m.div
        className={styles.skeletonAvatar}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    );
  }

  return (
    <div className={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <m.div
          key={i}
          className={styles.skeleton}
          style={{ height }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  );
};
