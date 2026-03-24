import { useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { CinematicExperience } from './components/CinematicExperience'
import { Dashboard } from './components/Dashboard'
import { CinematicScene } from './components/CinematicScene'
import { ScrollIndicator } from './components/ScrollIndicator'

type Tab = 'experiments' | 'train' | 'hpo' | 'models'
type View = 'cinematic' | 'dashboard'

const CHAPTER_TAB_MAP: Record<string, Tab> = {
  'CH 01': 'experiments',
  'CH 02': 'train',
  'CH 03': 'hpo',
  'CH 04': 'models',
  'experiments': 'experiments',
  'train': 'train',
  'hpo': 'hpo',
  'models': 'models'
}

function App() {
  const [view, setView] = useState<View>('cinematic')
  const [activeTab, setActiveTab] = useState<Tab>('experiments')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const contentLayerRef = useRef<HTMLDivElement>(null)

  const switchView = (newView: View, tab?: Tab) => {
    setIsTransitioning(true)
    setTimeout(() => {
      if (tab) setActiveTab(tab)
      setView(newView)
      setIsTransitioning(false)
    }, 200)
  }

  const enterWorkspace = (chapterId: string) => {
    // chapterId comes from onEnterWorkspace(ch.id) in CinematicExperience
    const tab = CHAPTER_TAB_MAP[chapterId] ?? 'experiments'
    switchView('dashboard', tab)
  }

  const returnToHub = () => switchView('cinematic')

  return (
    <div style={{ background: '#050505', minHeight: '100vh', position: 'relative' }}>
      {/* PERSISTENT 3D BACKGROUND */}
      <div style={{ 
        position: 'fixed', inset: 0, zIndex: 0,
        opacity: view === 'dashboard' ? 0.4 : 1,
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none'
      }}>
        <Canvas 
          id="three-canvas" 
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
        >
          <CinematicScene 
            scrollContainer={contentLayerRef} 
            isDashboardMode={view === 'dashboard'} 
            activeTab={activeTab}
          />
        </Canvas>
      </div>

      {/* UI LAYERS */}
      <div style={{ 
        position: 'relative', zIndex: 1,
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}>
        {view === 'cinematic' ? (
          <CinematicExperience 
            onEnterWorkspace={enterWorkspace} 
            contentLayerRef={contentLayerRef}
          />
        ) : (
          <Dashboard 
            activeTab={activeTab} 
            onBackToHub={returnToHub} 
            backendOnline={backendOnline}
            setBackendOnline={setBackendOnline} 
          />
        )}
      </div>

      <ScrollIndicator />
    </div>
  )
}

export default App;
