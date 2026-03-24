import { useRef } from 'react';
import { m, useScroll, useTransform } from 'framer-motion';
import { Hero3D } from './Hero3D';
import { Typewriter } from './Typewriter';
import styles from './MinimalScrollShowcase.module.css';

const SHOWCASE_ITEMS = [
  {
    id: 'visuals',
    badge: 'LUXURY DESIGN',
    title: 'Precision Aesthetics',
    description: 'A minimalist interface built on Obsidian & Platinum foundations, designed for maximum situational awareness.',
    visual: '3D Neural Network Rendering'
  },
  {
    id: 'performance',
    badge: 'OPTIMIZED CORE',
    title: 'Liquid Intelligence',
    description: 'High-performance WebGL backdrops and smooth scrollytelling architecture ensuring zero-latency interaction.',
    visual: 'Bezier Data Flows'
  },
  {
    id: 'ux',
    badge: 'Cinematic Flow',
    title: 'Weighted Motion',
    description: 'Every interaction is physically modeled with weighted scrolling and magnetic tactility for an award-winning experience.',
    visual: 'Physics-Based Transitions'
  }
];

export const MinimalScrollShowcase = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section ref={containerRef} className={styles.showcase}>
      {/* SNAP MARKERS */}
      <div className={styles.snapPoint} />
      <div className={styles.snapPoint} />
      <div className={styles.snapPoint} />
      <div className={styles.snapPoint} />

      <div className={styles.stickyWrapper}>
        <div className={styles.backdrop}>
          <Hero3D height="100%" scrollProgress={scrollYProgress} />
        </div>

        <div className={styles.featureContainer}>
          {SHOWCASE_ITEMS.map((item, index) => (
            <m.div
              key={item.id}
              className={styles.featurePane}
              style={{
                opacity: useTransform(
                  scrollYProgress,
                  [index * 0.33, index * 0.33 + 0.01, index * 0.33 + 0.32, index * 0.33 + 0.33],
                  [0, 1, 1, 0]
                ),
                scale: useTransform(
                  scrollYProgress,
                  [index * 0.33, index * 0.33 + 0.01, index * 0.33 + 0.32, index * 0.33 + 0.33],
                  [0.95, 1, 1, 0.95]
                ),
                y: useTransform(
                  scrollYProgress,
                  [index * 0.33, index * 0.33 + 0.33],
                  [10, -10]
                ),
                zIndex: Math.round(10 + index)
              }}
            >
              <div className={styles.featureInfo}>
                <span className={styles.tabBadge}>{item.badge}</span>
                <h2 className={styles.featureTitle}>
                  <Typewriter text={item.title} key={`${item.id}-title`} />
                </h2>
                <p className={styles.featureDescription}>{item.description}</p>
              </div>
            </m.div>
          ))}
        </div>

        <div className={styles.scrollHint}>
          SCROLL TO EXPLORE
        </div>
      </div>
    </section>
  );
};
