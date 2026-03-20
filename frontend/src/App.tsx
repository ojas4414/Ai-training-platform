import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m, useReducedMotion } from 'motion/react';

import { healthCheck, listDatasets, listModels } from './api';
import { AnimatedNumber } from './components/AnimatedNumber';
import { CustomCursor } from './components/CustomCursor';
import { InteractiveLanding } from './components/InteractiveLanding';
import { LoadingPanel } from './components/LoadingPanel';
import { MinimalScrollShowcase } from './components/MinimalScrollShowcase';
import { useDarkMode } from './hooks/useDarkMode';
import { useParallax } from './hooks/useParallax';
import { useCinematicAudio } from './hooks/useCinematicAudio';
import { useScroll, useMotionValueEvent } from 'motion/react';

export type Tab = 'experiments' | 'train' | 'hpo' | 'models';
type ViewMode = 'landing' | 'workspace';

type TabConfig = {
  id: Tab;
  label: string;
  description: string;
  badge: string;
};

const tabLoaders = {
  experiments: () => import('./components/ExperimentsTab').then(module => ({ default: module.ExperimentsTab })),
  train: () => import('./components/TrainTab').then(module => ({ default: module.TrainTab })),
  hpo: () => import('./components/HPOTab').then(module => ({ default: module.HPOTab })),
  models: () => import('./components/ModelsTab').then(module => ({ default: module.ModelsTab })),
} satisfies Record<Tab, () => Promise<{ default: ComponentType }>>;

const tabComponents = {
  experiments: lazy(tabLoaders.experiments),
  train: lazy(tabLoaders.train),
  hpo: lazy(tabLoaders.hpo),
  models: lazy(tabLoaders.models),
} satisfies Record<Tab, LazyExoticComponent<ComponentType>>;

const TABS: TabConfig[] = [
  { id: 'experiments', label: 'Command Center', description: 'Runs, trends, and outcomes', badge: '01' },
  { id: 'train', label: 'Experiment Builder', description: 'Launch guided training jobs', badge: '02' },
  { id: 'hpo', label: 'Search Studio', description: 'Find stronger hyperparameters', badge: '03' },
  { id: 'models', label: 'Assets Lab', description: 'Upload, inspect, and export assets', badge: '04' },
];

const createTabsWithSummary = (tabs: TabConfig[], chapterSummary: Record<Tab, { lead: string; note: string; metric: string }>) => {
  return tabs.map(tab => ({
    ...tab,
    lead: chapterSummary[tab.id].lead,
    note: chapterSummary[tab.id].note,
    metric: chapterSummary[tab.id].metric,
  }));
};

function TabFallback() {
  return (
    <LoadingPanel
      kicker="Workspace module"
      title="Loading selected workspace"
      text="This module loads on demand so the shell stays fast while heavier charts and controls arrive."
      compact
    />
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('experiments');
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [device, setDevice] = useState('cpu');
  const [assetCounts, setAssetCounts] = useState({ models: 0, datasets: 0 });
  const { isDark, toggleTheme } = useDarkMode();
  const { initAudio, playWhoosh, updateHum } = useCinematicAudio();
  const { scrollYProgress } = useScroll();

  // Track scroll for audio hum
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    updateHum(latest);
  });

  // Audio initialization on first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudio();
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('mousedown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [initAudio]);

  // Audio whoosh on scene changes
  useEffect(() => {
    playWhoosh();
  }, [viewMode, activeTab, playWhoosh]);

  const orbLeftY = useParallax(0.15);
  const orbRightY = useParallax(-0.1); // Move in opposite direction slightly for dynamic feel
  const gridY = useParallax(0.05);
  const activeWorkspace = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const prefersReducedMotion = useReducedMotion() ?? false;
  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);
  const chapterSummary = {
    experiments: {
      lead: 'Survey the strongest runs first.',
      note: 'Best for quick situational awareness, ranked experiments, and tracked MLflow history.',
      metric: `${assetCounts.models} model${assetCounts.models === 1 ? '' : 's'} available`,
    },
    train: {
      lead: 'Launch one focused training run.',
      note: 'Start with a single configuration, then reveal curves and checkpoint output after completion.',
      metric: backendOnline ? `Runtime on ${device.toUpperCase()}` : 'Waiting for backend',
    },
    hpo: {
      lead: 'Run a deeper search only when needed.',
      note: 'Treat hyperparameter search as its own scene, not as a wall of controls beside everything else.',
      metric: `${assetCounts.datasets} reusable dataset${assetCounts.datasets === 1 ? '' : 's'}`,
    },
    models: {
      lead: 'Intake assets, then inspect one selected model.',
      note: 'Uploads, prediction, analysis, and export stay in sequence instead of competing at once.',
      metric: `${assetCounts.datasets + assetCounts.models} total stored asset${assetCounts.datasets + assetCounts.models === 1 ? '' : 's'}`,
    },
  } satisfies Record<Tab, { lead: string; note: string; metric: string }>;

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([healthCheck(), listModels(), listDatasets()]).then(results => {
      if (cancelled) {
        return;
      }

      const [healthResult, modelResult, datasetResult] = results;

      if (healthResult.status === 'fulfilled') {
        setBackendOnline(true);
        setDevice(healthResult.value.device);
      } else {
        setBackendOnline(false);
      }

      if (modelResult.status === 'fulfilled') {
        setAssetCounts(current => ({ ...current, models: modelResult.value.models.length }));
      }

      if (datasetResult.status === 'fulfilled') {
        setAssetCounts(current => ({ ...current, datasets: datasetResult.value.datasets.length }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void tabLoaders[activeTab]();
  }, [activeTab]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [activeTab, prefersReducedMotion, viewMode]);

  const ActiveTabComponent = tabComponents[activeTab];
  const revealTransition = {
    duration: prefersReducedMotion ? 0.01 : 0.72,
    ease: [0.16, 1, 0.3, 1] as const,
  };
  const sceneTransition = {
    duration: prefersReducedMotion ? 0.01 : 0.88,
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

  const openWorkspace = (tabId: Tab) => {
    setActiveTab(tabId);
    setViewMode('workspace');
  };

  const returnToLanding = () => {
    setViewMode('landing');
  };

  const goToAdjacentChapter = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIndex]?.id ?? activeTab);
    setViewMode('workspace');
  };

  const sceneKey = viewMode === 'landing' ? 'landing-scene' : `workspace-scene-${activeTab}`;

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <div className="app-shell">
          <CustomCursor />
          <m.div className="app-orb app-orb-left" style={{ y: orbLeftY }} />
          <m.div className="app-orb app-orb-right" style={{ y: orbRightY }} />
          
          {/* Parallax Grid Layer */}
          <m.div 
            className="app-background-grid" 
            style={{ y: gridY }}
            aria-hidden="true"
          />

          <m.header
            className="topbar"
            initial={{
              opacity: 0,
              y: prefersReducedMotion ? 0 : -26,
              filter: prefersReducedMotion ? 'blur(0px)' : 'blur(10px)',
            }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={revealTransition}
          >
            <m.div className="topbar-brand" variants={shellStagger} initial="hidden" animate="visible">
              <m.div className="brand-mark" variants={revealUp}>
                ATP
              </m.div>
              <m.div variants={revealUp}>
                <div className="brand-eyebrow">AI systems workbench</div>
                <div className="brand-title">AI Training Platform</div>
              </m.div>
            </m.div>

            <m.div className="topbar-meta" variants={shellStagger} initial="hidden" animate="visible">
              <m.button 
                className="topbar-theme-toggle"
                onClick={toggleTheme}
                variants={revealUp}
                type="button"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? '☀️' : '🌙'}
              </m.button>
              <m.div className="topbar-chip" variants={revealUp}>
                Models
                <strong><AnimatedNumber value={assetCounts.models} /></strong>
              </m.div>
              <m.div className="topbar-chip" variants={revealUp}>
                Datasets
                <strong><AnimatedNumber value={assetCounts.datasets} /></strong>
              </m.div>
              <m.div className="topbar-status" variants={revealUp}>
                <span className={`status-pill ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : 'idle'}`}>
                  <span className="status-pill-dot" />
                  {backendOnline === true ? 'Backend online' : backendOnline === false ? 'Backend offline' : 'Checking backend'}
                </span>
              </m.div>
            </m.div>
          </m.header>

          <main className="main-content">
            <AnimatePresence initial={false}>
              {backendOnline === false && (
                <m.div
                  key="backend-offline"
                  className="alert alert-error banner-alert"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
                  transition={revealTransition}
                >
                  Backend is not reachable at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}. Start the API with
                  <code className="inline-code"> python -m uvicorn backend.api.main:app --reload </code>
                  from the project root.
                </m.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false} mode="wait">
              {viewMode === 'landing' ? (
                <m.div
                  key={sceneKey}
                  className="scene-shell landing-scene"
                  initial={{
                    opacity: 0,
                    y: prefersReducedMotion ? 0 : 36,
                    scale: prefersReducedMotion ? 1 : 0.988,
                    filter: prefersReducedMotion ? 'blur(0px)' : 'blur(18px)',
                    clipPath: prefersReducedMotion ? 'inset(0% 0% 0% 0% round 36px)' : 'inset(0 0 18% 0 round 36px)',
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    clipPath: 'inset(0% 0% 0% 0% round 36px)',
                  }}
                  exit={{
                    opacity: 0,
                    y: prefersReducedMotion ? 0 : -22,
                    scale: prefersReducedMotion ? 1 : 1.012,
                    filter: prefersReducedMotion ? 'blur(0px)' : 'blur(14px)',
                    clipPath: prefersReducedMotion ? 'inset(0% 0% 0% 0% round 36px)' : 'inset(14% 0 0 0 round 36px)',
                  }}
                  transition={sceneTransition}
                >
                  <InteractiveLanding
                    TABS={createTabsWithSummary(TABS, chapterSummary)}
                    onTabSelect={openWorkspace}
                    chapterSummary={chapterSummary}
                  />

                  <MinimalScrollShowcase />
                </m.div>
              ) : (
                <m.section
                  key={sceneKey}
                  className="scene-shell workspace-scene"
                  initial={{
                    opacity: 0,
                    y: prefersReducedMotion ? 0 : 42,
                    scale: prefersReducedMotion ? 1 : 0.986,
                    filter: prefersReducedMotion ? 'blur(0px)' : 'blur(20px)',
                    clipPath: prefersReducedMotion ? 'inset(0% 0% 0% 0% round 36px)' : 'inset(0 0 24% 0 round 36px)',
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    clipPath: 'inset(0% 0% 0% 0% round 36px)',
                  }}
                  exit={{
                    opacity: 0,
                    y: prefersReducedMotion ? 0 : -24,
                    scale: prefersReducedMotion ? 1 : 1.014,
                    filter: prefersReducedMotion ? 'blur(0px)' : 'blur(16px)',
                    clipPath: prefersReducedMotion ? 'inset(0% 0% 0% 0% round 36px)' : 'inset(12% 0 0 0 round 36px)',
                  }}
                  transition={sceneTransition}
                >
                  <div className="workspace-scene-shell">
                    <div className="workspace-scene-topline">
                      <button className="scene-back-button" onClick={returnToLanding} type="button">
                        All actions
                      </button>

                      <div className="workspace-scene-status">
                        <span>{backendOnline === true ? 'Backend live' : backendOnline === false ? 'Backend offline' : 'Checking backend'}</span>
                        <span>{device.toUpperCase()}</span>
                        <span>{chapterSummary[activeWorkspace.id].metric}</span>
                      </div>
                    </div>

                    <div className="workspace-scene-hero">
                      <div className="workspace-scene-copy">
                        <div className="page-kicker">Scene {activeWorkspace.badge}</div>
                        <h2 className="storyline-title">{activeWorkspace.label}</h2>
                        <p className="storyline-text">
                          {chapterSummary[activeWorkspace.id].lead} {chapterSummary[activeWorkspace.id].note}
                        </p>
                      </div>

                      <div className="workspace-scene-actions">
                        <button className="stage-nav-button" onClick={() => goToAdjacentChapter(-1)} type="button">
                          Previous scene
                        </button>
                        <button className="stage-nav-button" onClick={() => goToAdjacentChapter(1)} type="button">
                          Next scene
                        </button>
                      </div>
                    </div>

                    <div className="workspace-scene-metadata">
                      <div className="workspace-scene-card">
                        <div className="workspace-scene-card-label">Focus</div>
                        <div className="workspace-scene-card-title">{chapterSummary[activeWorkspace.id].lead}</div>
                        <div className="workspace-scene-card-text">{activeWorkspace.description}</div>
                      </div>
                      <div className="workspace-scene-card">
                        <div className="workspace-scene-card-label">Why this scene exists</div>
                        <div className="workspace-scene-card-title">Less simultaneous information</div>
                        <div className="workspace-scene-card-text">
                          This stage keeps one workflow dominant so results, controls, and status can land more gradually.
                        </div>
                      </div>
                      <div className="workspace-scene-card">
                        <div className="workspace-scene-card-label">Transition rule</div>
                        <div className="workspace-scene-card-title">Whole-page cinematic handoff</div>
                        <div className="workspace-scene-card-text">
                          Scene changes now happen at the shell level, closer to the second reference video you shared.
                        </div>
                      </div>
                    </div>

                    <m.div
                      className="workspace-scene-panel workspace-panel"
                      initial={{
                        opacity: 0,
                        y: prefersReducedMotion ? 0 : 30,
                        scale: prefersReducedMotion ? 1 : 0.988,
                        filter: prefersReducedMotion ? 'blur(0px)' : 'blur(12px)',
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                      }}
                      transition={revealTransition}
                    >
                      <Suspense fallback={<TabFallback />}>
                        <ActiveTabComponent />
                      </Suspense>
                    </m.div>
                  </div>
                </m.section>
              )}
            </AnimatePresence>
          </main>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}

export default App;
