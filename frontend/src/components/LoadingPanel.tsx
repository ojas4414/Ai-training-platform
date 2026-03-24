export const LoadingPanel = ({ title, text, kicker }: { title: string, text: string, kicker?: string }) => (
  <div className="loading-panel" style={{ width: '100%', minHeight: '500px', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
      {kicker && <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{kicker}</div>}
      <h3 style={{ fontFamily: 'var(--font-heading, "Space Grotesk")', fontSize: 24, fontWeight: 700, margin: 0 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{text}</p>
    </div>
    
    <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
        <div className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
      </div>
      <div className="skeleton" style={{ height: '240px', borderRadius: 'var(--radius-lg)' }} />
    </div>
  </div>
);
