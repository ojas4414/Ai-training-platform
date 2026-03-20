import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  grouping?: boolean;
};

function formatValue(value: number, decimals: number, grouping: boolean) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
}

export function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  grouping = true,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      const animationFrame = requestAnimationFrame(() => {
        setDisplayValue(value);
      });
      previousValue.current = value;
      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }

    let animationFrame = 0;
    const start = performance.now();
    const startValue = previousValue.current;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(startValue + (value - startValue) * eased);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
      }
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [duration, prefersReducedMotion, value]);

  return <>{`${prefix}${formatValue(displayValue, decimals, grouping)}${suffix}`}</>;
}
