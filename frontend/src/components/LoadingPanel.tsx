import React from 'react';

type LoadingPanelProps = {
  kicker?: string;
  title: string;
  text: string;
  compact?: boolean;
  cards?: number;
  rows?: number;
};

export const LoadingPanel: React.FC<LoadingPanelProps> = ({
  kicker = 'Loading state',
  title,
  text,
  compact = false,
  cards = compact ? 2 : 3,
  rows = compact ? 3 : 4,
}) => {
  return (
    <div className={`loading-panel ${compact ? 'compact' : ''}`}>
      <div className="loading-panel-copy">
        <div className="loading-panel-kicker">{kicker}</div>
        <div className="loading-panel-title">{title}</div>
        <div className="loading-panel-text">{text}</div>
      </div>

      <div className="loading-panel-visual" aria-hidden="true">
        <div className="loading-panel-card-grid">
          {Array.from({ length: cards }, (_, index) => (
            <div className="loading-panel-card loading-shimmer" key={`card-${index}`} />
          ))}
        </div>
        <div className="loading-panel-lines">
          {Array.from({ length: rows }, (_, index) => (
            <span
              className={`loading-line loading-shimmer ${
                index === rows - 1 ? 'short' : index % 2 === 0 ? 'full' : 'medium'
              }`}
              key={`line-${index}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
