import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export const Typewriter = ({ 
  text, 
  speed = 40, 
  delay = 0, 
  className = '',
  onComplete 
}: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsDone(false);
    
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          setIsDone(true);
          onComplete?.();
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, speed, delay, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      <AnimatePresence>
        {!isDone && (
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse" }}
            style={{ 
              display: 'inline-block', 
              width: '2px', 
              height: '1em', 
              background: 'currentColor', 
              marginLeft: '2px',
              verticalAlign: 'middle'
            }}
          />
        )}
      </AnimatePresence>
    </span>
  );
};
