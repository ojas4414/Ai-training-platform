import { useEffect } from 'react';
import { m, useSpring, useTransform } from 'framer-motion';

export const AnimatedNumber = ({ value }: { value: number }) => {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const displayValue = useTransform(spring, (latest) => Math.floor(latest));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <m.span>{displayValue}</m.span>;
};
