import { useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { HeroScene } from './HeroScene';
import type { Tab } from '../App';

interface InteractiveLandingProps {
  TABS: Array<{ id: Tab; label: string; description: string; badge: string; lead: string; note: string; metric: string }>;
  onTabSelect: (tabId: Tab) => void;
  chapterSummary: Record<Tab, { lead: string; note: string; metric: string }>;
}

export function InteractiveLanding({
  TABS,
  onTabSelect,
  chapterSummary,
}: InteractiveLandingProps) {
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 500], [0, 100]);

  const revealTransition = {
    duration: prefersReducedMotion ? 0.01 : 0.72,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  const shellStagger = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.1,
        delayChildren: prefersReducedMotion ? 0 : 0.08,
      },
    },
  };

  const revealUp = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 30,
      scale: prefersReducedMotion ? 1 : 0.985,
      filter: prefersReducedMotion ? 'blur(0px)' : 'blur(10px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: revealTransition,
    },
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <m.div
          className="interactive-landing"
          layout
        >
          {/* HERO SECTION - CLICKABLE */}
          <m.section
            className={`hero-panel-interactive ${heroCollapsed ? 'collapsed' : ''}`}
            onClick={() => setHeroCollapsed(!heroCollapsed)}
            animate={{
              height: heroCollapsed ? '120px' : 'auto',
              marginBottom: heroCollapsed ? '0px' : '80px',
            }}
            transition={revealTransition}
            style={{ cursor: 'pointer' }}
          >
            <m.div
              style={{ y: prefersReducedMotion ? 0 : heroParallax }}
              animate={{
                opacity: heroCollapsed ? 0.6 : 1,
                scale: heroCollapsed ? 0.9 : 1,
              }}
              transition={revealTransition}
            >
              <HeroScene reducedMotion={prefersReducedMotion} />
            </m.div>

            {/* HERO CONTENT - SHOWS/HIDES */}
            <AnimatePresence initial={false}>
              {!heroCollapsed && (
                <m.div
                  className="hero-content-column"
                  variants={shellStagger}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <m.div className="hero-copy" variants={revealUp}>
                    <div className="hero-kicker">Click the 3D logo to reveal your options</div>
                    <h1 className="hero-title">Choose one action, then let the entire product pivot into that scene.</h1>
                    <p className="hero-text">
                      Start from a cinematic front door that presents every core workflow clearly. Once you choose a
                      mode, the shell gives that task the whole stage instead of crowding everything onto one page.
                    </p>
                  </m.div>
                </m.div>
              )}
            </AnimatePresence>

            {/* COLLAPSE INDICATOR */}
            <m.div
              className="hero-collapse-hint"
              animate={{
                opacity: heroCollapsed ? 1 : 0,
                y: heroCollapsed ? 0 : -10,
              }}
              transition={{ duration: 0.3 }}
              style={{ cursor: 'pointer', textAlign: 'center', fontSize: '12px', color: '#888' }}
            >
              Click to expand options
            </m.div>
          </m.section>

          {/* CHAPTER SELECTION - ANIMATED REVEAL */}
          <AnimatePresence initial={false}>
            {heroCollapsed && (
              <m.section
                className="chapter-overview-interactive"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
                transition={revealTransition}
              >
                <m.div className="chapter-overview-copy" variants={revealUp}>
                  <div className="page-kicker">Scene Selection</div>
                  <h2 className="storyline-title">Choose your workflow.</h2>
                  <p className="storyline-text">
                    Every major workflow appears here. Click one and the interface shifts into a dedicated scene
                    instead of pushing more cards further down the page.
                  </p>
                </m.div>

                <m.div className="chapter-grid" variants={shellStagger} initial="hidden" animate="visible">
                  {TABS.map(tab => (
                    <m.button
                      key={tab.id}
                      className="chapter-card-interactive"
                      onClick={() => onTabSelect(tab.id)}
                      type="button"
                      variants={revealUp}
                      whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.992 }}
                      transition={{ duration: prefersReducedMotion ? 0.01 : 0.38, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="chapter-card-index">Scene {tab.badge}</div>
                      <div className="chapter-card-title">{tab.label}</div>
                      <div className="chapter-card-text">{chapterSummary[tab.id].lead}</div>
                      <div className="chapter-card-note">{chapterSummary[tab.id].note}</div>
                      <div className="chapter-card-meta">
                        <span>{chapterSummary[tab.id].metric}</span>
                        <span>{tab.description}</span>
                      </div>
                      <div className="chapter-card-action">
                        <span>Open cinematic scene</span>
                        <span aria-hidden="true">+</span>
                      </div>
                    </m.button>
                  ))}
                </m.div>
              </m.section>
            )}
          </AnimatePresence>
        </m.div>
      </LazyMotion>
    </MotionConfig>
  );
}
