import type { CSSProperties, PropsWithChildren } from 'react';
import { m, useReducedMotion } from 'motion/react';

type RevealProps = PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
  delay?: number;
  distance?: number;
  amount?: number;
  once?: boolean;
}>;

export function Reveal({
  children,
  className,
  style,
  delay = 0,
  distance = 24,
  amount = 0.22,
  once = true,
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      style={style}
      initial={{
        opacity: 0,
        y: prefersReducedMotion ? 0 : distance,
        scale: prefersReducedMotion ? 1 : 0.985,
        filter: prefersReducedMotion ? 'blur(0px)' : 'blur(12px)',
      }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once, amount }}
      transition={{
        duration: prefersReducedMotion ? 0.01 : 0.64,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </m.div>
  );
}
