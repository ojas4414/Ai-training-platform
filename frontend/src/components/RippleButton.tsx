import { useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useCinematicAudio } from '../hooks/useCinematicAudio';
import styles from './RippleButton.module.css';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  'aria-label'?: string;
}

export const RippleButton = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  title,
  'aria-label': ariaLabel,
}: RippleButtonProps) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const { playClick } = useCinematicAudio();

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const diameter = Math.max(rect.width, rect.height);
    
    const newRipple: Ripple = {
      id: Date.now(),
      x,
      y,
      size: diameter,
    };

    setRipples((prev) => [...prev, newRipple]);
    
    // Auto-cleanup
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 800);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    playClick();
    createRipple(e);
    onClick?.(e);
  };

  return (
    <m.button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      onClick={handleClick}
      type={type}
      title={title}
    >
      {/* Liquid Ripples */}
      <span className={styles.rippleContainer}>
        <AnimatePresence>
          {ripples.map((ripple) => (
            <m.span
              key={ripple.id}
              className={styles.ripple}
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
              }}
            />
          ))}
        </AnimatePresence>
      </span>

      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
    </m.button>
  );
};
