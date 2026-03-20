import { m } from 'motion/react';

export type IconType = 'play' | 'check' | 'alert' | 'info' | 'arrow-right';

interface FluidIconProps {
  type: IconType;
  size?: number;
  color?: string;
  className?: string;
}

const PATHS: Record<IconType, string> = {
  play: "M8 5v14l11-7z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  alert: "M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  'arrow-right': "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
};

export const FluidIcon = ({ 
  type, 
  size = 24, 
  color = "currentColor",
  className = "" 
}: FluidIconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      className={className}
    >
      <m.path
        initial={false}
        animate={{ d: PATHS[type] }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 12, // Elastic bounce
          mass: 1,
        }}
      />
    </svg>
  );
};
