import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export const CinematicExperience = ({ 
  onEnterWorkspace, 
  contentLayerRef 
}: { 
  onEnterWorkspace: (id: string) => void,
  contentLayerRef: React.RefObject<HTMLDivElement | null>
}) => {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    // RULE 1: Lenis + ScrollTrigger sync
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // RULE 2: CSS sticky pinning with ScrollTrigger tracking wrappers
    const wrappers = gsap.utils.toArray('.section-wrapper');
    wrappers.forEach((wrapper: any, index: number) => {
      ScrollTrigger.create({
        trigger: wrapper,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5
      });

      // Dot tracker
      ScrollTrigger.create({
        trigger: wrapper,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => setActiveSection(index),
        onEnterBack: () => setActiveSection(index)
      });
    });

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  const chapters = [
    { id: 'CH 01', ch: 'CH 01', title: 'Command Center', subtitle: 'Survey the strongest runs first.' },
    { id: 'CH 02', ch: 'CH 02', title: 'Experiment Builder', subtitle: 'Launch one focused training run.' },
    { id: 'CH 03', ch: 'CH 03', title: 'Search Studio', subtitle: 'Run a deeper search only when needed.' },
    { id: 'CH 04', ch: 'CH 04', title: 'Assets Lab', subtitle: 'Intake assets, then inspect one selected model.' }
  ];

  return (
    <div id="cinematic-container" style={{ position: 'relative', minHeight: '100vh' }}>
      
      <div id="content-layer" ref={contentLayerRef} style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}>
        
        {/* Hub / Cosmos */}
        <div className="section-wrapper" style={{ position: 'relative', height: '120vh', overflow: 'hidden' }}>
          <section className="cinematic-section" style={{ height: '100vh', position: 'sticky', top: 0, overflow: 'visible' }}>
            <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
            
            <div className="reveal-text" style={{ position: 'absolute', top: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 'clamp(48px, 8vw, 120px)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>AI</div>
              <div style={{ fontSize: 'clamp(48px, 8vw, 120px)', fontWeight: 900, color: 'rgba(255,255,255,0.15)', lineHeight: 1 }}>TRAINING</div>
              <div style={{ fontSize: 'clamp(48px, 8vw, 120px)', fontWeight: 900, color: '#1D9E75', lineHeight: 1 }}>PLATFORM</div>
            </div>
            
            <div className="reveal-text" style={{ position: 'absolute', left: '40px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left center', fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              AI SYSTEMS WORKBENCH
            </div>

            <div className="reveal-text" style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', maxWidth: '300px' }}>
                High-performance model training, hyperparameter optimization, and ONNX export pipeline.
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#FFFFFF', letterSpacing: '0.15em', animation: 'blink 2s infinite' }}>
                SCROLL & DISCOVER ↓
              </div>
            </div>
          </section>
        </div>

        {/* 4 Workspace Chapters */}
        {chapters.map((ch) => (
          <div key={ch.id} className="section-wrapper" style={{ position: 'relative', height: '120vh', pointerEvents: 'none', overflow: 'hidden' }}>
            <section className="cinematic-section" style={{ height: '100vh', display: 'flex', alignItems: 'center', padding: '10vw', background: 'transparent', position: 'sticky', top: 0, overflow: 'visible' }}>
              <div style={{ pointerEvents: 'auto', maxWidth: '400px' }}>
                <div className="reveal-text" style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 900 }}>{ch.ch.split(' ')[0]}</span>
                  <span style={{ color: '#1D9E75', fontWeight: 900 }}>{ch.ch.split(' ')[1]}</span>
                </div>
                <h2 className="reveal-text" style={{ fontSize: 'clamp(48px, 7vw, 96px)', fontWeight: 900, lineHeight: 1, marginBottom: '24px' }}>
                  <span style={{ color: '#FFFFFF' }}>{ch.title.split(' ')[0]}</span>
                  {ch.title.split(' ').length > 1 && (
                    <span style={{ color: '#1D9E75', marginLeft: '12px' }}>{ch.title.split(' ').slice(1).join(' ')}</span>
                  )}
                </h2>
                <p className="reveal-text" style={{ fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginBottom: '32px' }}>
                  {ch.subtitle}
                </p>
                <button 
                  className="reveal-text btn"
                  style={{ fontSize: '13px', letterSpacing: '0.08em', color: '#1D9E75', background: 'transparent', padding: 0, cursor: 'pointer', transition: 'opacity 0.2s, transform 0.2s' }}
                  onClick={() => onEnterWorkspace(ch.id)}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'translateX(6px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  [Enter Workspace →]
                </button>
              </div>
            </section>
          </div>
        ))}

        {/* Footer block to allow final pin release */}
        <section style={{ height: '50vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', pointerEvents: 'auto' }}>
            AI TRAINING PLATFORM CORE
          </div>
        </section>

        {/* Global Vertical Dot Nav Indicator */}
        <div style={{
           position: 'fixed', right: '40px', top: '50%', transform: 'translateY(-50%)',
           zIndex: 100, display: 'flex', flexDirection: 'column', gap: '16px',
           opacity: activeSection > 0 ? 1 : 0, transition: 'opacity 0.5s ease', pointerEvents: 'none'
        }}>
          {[0, 1, 2, 3, 4].map((idx) => (
             <div key={idx} style={{
                width: idx === activeSection ? '8px' : '4px',
                height: idx === activeSection ? '8px' : '4px',
                borderRadius: '50%',
                background: idx === activeSection ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                margin: '0 auto',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
             }} />
          ))}
        </div>

      </div>
    </div>
  );
};
