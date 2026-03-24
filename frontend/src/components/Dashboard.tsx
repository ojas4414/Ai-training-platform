import { Suspense, lazy, useEffect } from 'react';
import { healthCheck } from '../api';
import React from 'react';

export type Tab = 'experiments' | 'train' | 'hpo' | 'models';

const tabLoaders = {
  experiments: () => import('./ExperimentsTab').then(module => ({ default: module.ExperimentsTab })),
  train: () => import('./TrainTab').then(module => ({ default: module.TrainTab })),
  hpo: () => import('./HPOTab').then(module => ({ default: module.HPOTab })),
  models: () => import('./ModelsTab').then(module => ({ default: module.ModelsTab })),
} satisfies Record<Tab, () => Promise<{ default: React.ComponentType }>>;

const tabComponents = {
  experiments: lazy(tabLoaders.experiments),
  train: lazy(tabLoaders.train),
  hpo: lazy(tabLoaders.hpo),
  models: lazy(tabLoaders.models),
} satisfies Record<Tab, React.LazyExoticComponent<React.ComponentType>>;

function TabFallback() {
  return (
    <div className="tab-loading-shell">
      <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton" style={{ height: '32px', width: '40%', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '60%', borderRadius: '6px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px' }}>
          <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: '12px', marginTop: '16px' }} />
      </div>
    </div>
  );
}

interface DashboardProps {
  activeTab: Tab;
  onBackToHub: () => void;
  backendOnline: boolean | null;
  setBackendOnline: (online: boolean | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  activeTab, 
  onBackToHub,
  backendOnline,
  setBackendOnline
}) => {
  useEffect(() => {
    if (backendOnline === null) {
      healthCheck()
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false));
    }
  }, [backendOnline, setBackendOnline]);

  useEffect(() => {
    void tabLoaders[activeTab]();
  }, [activeTab]);

  const ActiveTabComponent = tabComponents[activeTab];

  return (
    <div className="app dashboard-view hud-overlay">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <button className="back-to-hub-btn" onClick={onBackToHub}>
              ← Back to Hub
            </button>
            <div className="logo-icon">AI</div>
            <span className="logo-text">AI Training Platform</span>
            <span className="logo-badge">v1.0</span>
          </div>

          <div className="header-status">
            {backendOnline === null && <span>Connecting...</span>}
            {backendOnline === true && (
              <>
                <div className="status-dot" />
                API Online
              </>
            )}
            {backendOnline === false && (
              <span style={{ color: '#ef4444', fontSize: 12 }}>
                Backend offline. Start uvicorn.
              </span>
            )}
          </div>
        </div>
      </header>

      {backendOnline === false && (
        <div className="alert alert-error" style={{ borderRadius: 0, margin: 0 }}>
          Backend is not reachable. Run: <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0 6px', borderRadius: 4 }}>python -m uvicorn backend.api.main:app --reload</code>
        </div>
      )}

      <main className="main-content">
        <Suspense fallback={<TabFallback />}>
          <ActiveTabComponent />
        </Suspense>
      </main>
    </div>
  );
};
