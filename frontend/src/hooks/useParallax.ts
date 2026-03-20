import { useScroll, useTransform, type MotionValue } from 'motion/react';

/**
 * A hook that returns a parallax translation value based on scroll position.
 * @param speed - The factor by which to multiply the scroll offset (e.g., 0.1 for slow, 0.5 for medium).
 * @param direction - 'vertical' or 'horizontal'
 * @returns A MotionValue representing the translation.
 */
export function useParallax(speed = 0.2, direction: 'vertical' | 'horizontal' = 'vertical'): MotionValue<number> {
  const { scrollY, scrollX } = useScroll();
  const scrollValue = direction === 'vertical' ? scrollY : scrollX;
  
  return useTransform(scrollValue, [0, 10000], [0, 10000 * speed]);
}
