/**
 * Skip to Main Content Link
 * Provides keyboard navigation for screen reader users
 */

export const SkipToMainContent = () => {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        background: 'var(--accent-primary)',
        color: 'white',
        padding: '8px 12px',
        textDecoration: 'none',
        zIndex: 9999,
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.top = '0';
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.top = '-40px';
      }}
    >
      Skip to main content
    </a>
  );
};
