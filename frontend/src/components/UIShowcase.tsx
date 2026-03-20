import { Suspense } from 'react';
import { m } from 'motion/react';
import { GlassCard, RippleButton, SkeletonLoader, StatRing, Hero3D } from './index';
import styles from './UIShowcase.module.css';

export const UIShowcase = () => {
  return (
    <m.div 
      className={styles.showcase}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.header}>
        <h2>✨ New Professional UI Features</h2>
        <p>Glasmorphic Design • 3D Animations • Dynamic Transitions</p>
      </div>

      {/* 3D HERO SECTION */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h3>🌌 3D Neural Network Visualization</h3>
        <p>Interactive particle system that follows your mouse</p>
        <Suspense fallback={<SkeletonLoader variant="cards" count={1} />}>
          <Hero3D height="300px" autoRotate={true} />
        </Suspense>
      </m.section>

      {/* GLASSMORPHIC CARDS */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <h3>💎 Glassmorphic Cards (Hover to see effect)</h3>
        <div className={styles.cardGrid}>
          {(['accent', 'secondary', 'success', 'danger'] as const).map(glow => (
            <GlassCard key={glow} glow={glow} hoverable={true}>
              <div className={styles.cardContent}>
                <div className={styles.cardIcon}>✨</div>
                <h4>{glow.charAt(0).toUpperCase() + glow.slice(1)}</h4>
                <p>Frosted glass with {glow} glow effect</p>
                <button className={styles.cardButton}>Hover me</button>
              </div>
            </GlassCard>
          ))}
        </div>
      </m.section>

      {/* STAT RINGS */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        viewport={{ once: true }}
      >
        <h3>📊 Animated Stat Rings</h3>
        <p>Circular progress indicators with smooth animations</p>
        <div className={styles.ringGrid}>
          <StatRing percentage={85} label="GPU Usage" icon="⚡" color="danger" />
          <StatRing percentage={72} label="Memory" icon="💾" color="secondary" />
          <StatRing percentage={95} label="Accuracy" icon="🎯" color="success" />
          <StatRing percentage={60} label="Training" icon="🏋️" color="accent" />
        </div>
      </m.section>

      {/* ADVANCED BUTTONS */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        viewport={{ once: true }}
      >
        <h3>🔘 Advanced Button Variants</h3>
        <div className={styles.buttonGrid}>
          <div className={styles.buttonColumn}>
            <h4>Primary (with ripple effect)</h4>
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
      </m.section>

      {/* LOADING STATES */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        viewport={{ once: true }}
      >
        <h3>⏳ Animated Loading States</h3>
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
      </m.section>

      {/* TRANSITIONS & ANIMATIONS */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        viewport={{ once: true }}
      >
        <h3>🎬 Smooth Transitions & Micro-interactions</h3>
        <div className={styles.transitionDemo}>
          <m.div
            className={styles.animatedBox}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 10 }}
          >
            Hover & Click me!
          </m.div>
          
          <m.div
            className={styles.animatedBox}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Floating Animation
          </m.div>
          
          <m.div
            className={styles.animatedBox}
            animate={{ 
              background: ['#d8b36a', '#a9644f', '#90aa84', '#d8b36a']
            }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            Color Cycling
          </m.div>
        </div>
      </m.section>

      {/* DARK MODE NOTICE */}
      <m.section 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        viewport={{ once: true }}
      >
        <GlassCard glow="accent">
          <div className={styles.notice}>
            <h3>🌙 Dark Mode Supported</h3>
            <p>Click the 🌙 button in the top-right to toggle between light and dark themes. Your preference is saved automatically!</p>
            <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '12px' }}>
              Theme uses smooth CSS transitions for seamless switching.
            </p>
          </div>
        </GlassCard>
      </m.section>
    </m.div>
  );
};
