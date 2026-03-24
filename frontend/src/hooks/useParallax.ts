import { useScroll, useTransform } from 'framer-motion';

export const useParallax = (speed = 0.1) => {
  const { scrollY } = useScroll();
  return useTransform(scrollY, [0, 1000], [0, 1000 * speed]);
};
