import { Suspense, useRef, useState, useMemo } from 'react';
import { AnimatePresence, m, useScroll, useTransform, useMotionValueEvent, useSpring } from 'motion/react';
import { GlassCard, RippleButton, SkeletonLoader, StatRing, Hero3D } from './index';
import { Typewriter } from './Typewriter';
import styles from './MinimalScrollShowcase.module.css';

interface Feature {
  id: string;
  badge: string;
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  { id: 'hero3d', badge: '01', title: '3D Neural Network', description: 'Interactive visualization', icon: '🌌' },
  { id: 'glass', badge: '02', title: 'Glassmorphic Cards', description: 'Frosted glass with glow', icon: '💎' },
  { id: 'stats', badge: '03', title: 'Animated Metrics', description: 'Stat rings and indicators', icon: '📊' },
  { id: 'buttons', badge: '04', title: 'Advanced Buttons', description: 'Ripple & elevation effects', icon: '🔘' },
  { id: 'loading', badge: '05', title: 'Loading States', description: 'Animated skeletons', icon: '⏳' },
  { id: 'transitions', badge: '06', title: 'Smooth Transitions', description: 'Micro-interactions', icon: '🎬' },
];

export const MinimalScrollShowcase = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const activeFeature = FEATURES[activeFeatureIndex];

  // Monitor scroll within the component
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth the scroll progress for a "weighted" feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Transform scroll progress to feature index
  const indexValue = useTransform(smoothProgress, [0, 1], [0, FEATURES.length - 1]);

  useMotionValueEvent(indexValue, 'change', (latest) => {
    const rounded = Math.round(latest);
    if (rounded !== activeFeatureIndex) {
      setActiveFeatureIndex(rounded);
    }
  });

  const renderFeatureContent = () => {
    switch (activeFeature.id) {
      case 'hero3d':
        return (
          <div className={styles.featureContent}>
            <Suspense fallback={<SkeletonLoader variant="cards" count={1} />}>
              <Hero3D height="400px" autoRotate={true} scrollProgress={scrollYProgress} />
            </Suspense>
            <p className={styles.featureDescription}>
              Interactive particle system that responds to your mouse movements. Built with Three.js and React Three Fiber.
            </p>
          </div>
        );

      case 'glass':
        return (
          <div className={styles.featureContent}>
            <div className={styles.cardGrid}>
              {(['accent', 'secondary', 'success', 'danger'] as const).map(glow => (
                <GlassCard key={glow} glow={glow} hoverable={true}>
                  <div className={styles.cardContent}>
                    <div className={styles.cardIcon}>✨</div>
                    <h4>{glow.charAt(0).toUpperCase() + glow.slice(1)}</h4>
                    <p>Frosted glass effect</p>
                    <button className={styles.cardButton}>Interact</button>
                  </div>
                </GlassCard>
              ))}
            </div>
            <p className={styles.featureDescription}>
              Hover over cards to see the 3D tilt effect. Each card has a unique color glow that responds to your interaction.
            </p>
          </div>
        );

      case 'stats':
        return (
          <div className={styles.featureContent}>
            <div className={styles.ringGrid}>
              <StatRing percentage={85} label="GPU Usage" icon="⚡" color="danger" />
              <StatRing percentage={72} label="Memory" icon="💾" color="secondary" />
              <StatRing percentage={95} label="Accuracy" icon="🎯" color="success" />
              <StatRing percentage={60} label="Training" icon="🏋️" color="accent" />
            </div>
            <p className={styles.featureDescription}>
              Circular progress indicators animate smoothly with custom easing. Perfect for displaying real-time metrics.
            </p>
          </div>
        );

      case 'buttons':
        return (
          <div className={styles.featureContent}>
            <div className={styles.buttonGrid}>
              <div className={styles.buttonColumn}>
                <h4>Primary</h4>
                <RippleButton variant="primary" size="md" icon="✓">
                  Primary Action
                </RippleButton>
              </div>
              <div className={styles.buttonColumn}>
                <h4>Secondary</h4>
                <RippleButton variant="secondary" size="md" icon="→">
                  Secondary
                </RippleButton>
              </div>
              <div className={styles.buttonColumn}>
                <h4>Outline</h4>
                <RippleButton variant="outline" size="md" icon="🔗">
                  Outline
                </RippleButton>
              </div>
              <div className={styles.buttonColumn}>
                <h4>Ghost</h4>
                <RippleButton variant="ghost" size="md" icon="👻">
                  Ghost
                </RippleButton>
              </div>
            </div>
            <p className={styles.featureDescription}>
              Each button variant includes elevation effects, glow states, and smooth transitions. Click to see ripple animations.
            </p>
          </div>
        );

      case 'loading':
        return (
          <div className={styles.featureContent}>
            <div className={styles.loadingDemo}>
              <div className={styles.loadingColumn}>
                <h4>Line Skeleton</h4>
                <SkeletonLoader variant="lines" count={3} />
              </div>
              <div className={styles.loadingColumn}>
                <h4>Card Skeleton</h4>
                <SkeletonLoader variant="cards" count={2} />
              </div>
            </div>
            <p className={styles.featureDescription}>
              Animated skeleton loaders provide visual feedback while content is loading. Smooth pulsing effects guide user attention.
            </p>
          </div>
        );

      case 'transitions':
        return (
          <div className={styles.featureContent}>
            <div className={styles.transitionDemo}>
              <m.div
                className={styles.animatedBox}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 10 }}
              >
                Scale & Rotate
              </m.div>

              <m.div
                className={styles.animatedBox}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Floating
              </m.div>

              <m.div
                className={styles.animatedBox}
                animate={{
                  background: ['#d8b36a', '#a9644f', '#90aa84', '#d8b36a'],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                Color Cycling
              </m.div>
            </div>
            <p className={styles.featureDescription}>
              Smooth micro-interactions powered by motion/react. Hover and click to see spring dynamics and continuous animations.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const handleTabClick = (index: number) => {
    if (!containerRef.current) return;
    const scrollAmount = (index / (FEATURES.length - 1)) * (containerRef.current.scrollHeight - window.innerHeight);
    window.scrollTo({
      top: containerRef.current.offsetTop + scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={styles.showcase} ref={containerRef}>
      <div className={styles.stickyWrapper}>
        {/* 3D Backdrop */}
        <div className={styles.backdrop}>
          <Suspense fallback={null}>
            <Hero3D height="100%" autoRotate={true} scrollProgress={smoothProgress} />
          </Suspense>
        </div>

        {/* Cinematic HUD Navigation */}
        <nav className={styles.tabNavigation}>
          {FEATURES.map((feature, index) => (
            <button
              key={feature.id}
              className={`${styles.tab} ${activeFeatureIndex === index ? styles.active : ''}`}
              onClick={() => handleTabClick(index)}
            >
              {feature.title}
            </button>
          ))}
        </nav>

        {/* Feature Overlay */}
        <div className={styles.featureContainer}>
          <AnimatePresence mode="wait">
            <m.div
              key={activeFeature.id}
              className={styles.featurePane}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Feature Text */}
              <div className={styles.featureInfo}>
                <span className={styles.tabBadge}>CASE // {activeFeature.badge}</span>
                <h2 className={styles.featureTitle}>
                  <Typewriter text={activeFeature.title} speed={50} />
                </h2>
                <p className={styles.featureDescription}>
                  {activeFeature.description}
                </p>
              </div>

              {/* Interactive Preview - Right Side */}
              <div className={styles.featureVisual}>
                <m.div 
                  className={styles.glassPreview}
                  initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                >
                  {renderFeatureContent()}
                </m.div>
              </div>
            </m.div>
          </AnimatePresence>
        </div>

        {/* Scroll Hint */}
        <div className={styles.scrollHint}>
          Explore Neural Architecture
        </div>
      </div>
    </div>
  );
};
