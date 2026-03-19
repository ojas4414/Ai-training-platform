import { Suspense, lazy, useEffect, useState } from 'react';
import { healthCheck } from './api';

type Tab = 'experiments' | 'train' | 'hpo' | 'models';

type TabConfig = {
  id: Tab;
  label: string;
  badge: string;
};

const tabLoaders = {
  experiments: () => import('./components/ExperimentsTab').then(module => ({ default: module.ExperimentsTab })),
  train: () => import('./components/TrainTab').then(module => ({ default: module.TrainTab })),
  hpo: () => import('./components/HPOTab').then(module => ({ default: module.HPOTab })),
  models: () => import('./components/ModelsTab').then(module => ({ default: module.ModelsTab })),
} satisfies Record<Tab, () => Promise<{ default: React.ComponentType }>>;

const tabComponents = {
  experiments: lazy(tabLoaders.experiments),
  train: lazy(tabLoaders.train),
  hpo: lazy(tabLoaders.hpo),
  models: lazy(tabLoaders.models),
} satisfies Record<Tab, React.LazyExoticComponent<React.ComponentType>>;

const TABS: TabConfig[] = [
  { id: 'experiments', label: 'Experiments', badge: 'EXP' },
  { id: 'train', label: 'Train', badge: 'TRN' },
  { id: 'hpo', label: 'HPO Search', badge: 'HPO' },
  { id: 'models', label: 'Model Lab', badge: 'LAB' },
];

function TabFallback() {
  return (
    <div className="tab-loading-shell">
      <div className="spinner" />
      <div className="tab-loading-title">Loading dashboard module...</div>
      <div className="tab-loading-text">The tab code is being loaded on demand to keep the initial bundle smaller.</div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('experiments');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    healthCheck()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
    void tabLoaders[activeTab]();
  }, [activeTab]);

  const ActiveTabComponent = tabComponents[activeTab];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <div className="logo-icon">AI</div>
            <span className="logo-text">AI Training Platform</span>
            <span className="logo-badge">v1.0</span>
          </div>

          <nav className="header-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => {
                  void tabLoaders[tab.id]();
                }}
                id={`nav-${tab.id}`}
              >
                <span className="nav-tab-badge">{tab.badge}</span>
                {tab.label}
              </button>
            ))}
          </nav>

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
          Backend is not reachable at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}.
          Run:{' '}
          <code
            style={{
              fontFamily: 'monospace',
              background: 'rgba(0,0,0,0.2)',
              padding: '0 6px',
              borderRadius: 4,
            }}
          >
            python -m uvicorn backend.api.main:app --reload
          </code>{' '}
          in the project root.
        </div>
      )}

      <main className="main-content">
        <Suspense fallback={<TabFallback />}>
          <ActiveTabComponent />
        </Suspense>
      </main>
    </div>
  );
}

export default App;
