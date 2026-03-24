import { m } from 'framer-motion';
import { Typewriter } from './Typewriter';

interface TabConfig {
  id: string;
  label: string;
  badge: string;
  lead: string;
  note: string;
}

export const InteractiveLanding = ({ TABS, onTabSelect }: { TABS: TabConfig[], onTabSelect: (id: any) => void }) => {
  return (
    <div className="interactive-landing">
      <div className="hero-section">
        <h1 className="hero-title">
          <Typewriter text="Architect the Future" speed={80} />
          <br />
          <span style={{ color: 'var(--text-muted)' }}>of Intelligence</span>
        </h1>
        <p className="hero-subtitle">
          Command your training infrastructure with cinematic precision.
        </p>
      </div>

      <div className="chapter-grid">
        {TABS.map((tab) => (
          <m.div
            key={tab.id}
            className="chapter-card"
            data-animate="true"
            whileHover={{ y: -10, borderColor: 'var(--accent-primary)' }}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="chapter-badge">CH {tab.badge}</span>
            <h3 className="chapter-title">{tab.label}</h3>
            <p className="chapter-lead">{tab.lead}</p>
            <div className="chapter-footer">Enter Workspace →</div>
          </m.div>
        ))}
      </div>
    </div>
  );
};
