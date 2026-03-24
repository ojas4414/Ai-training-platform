import { useEffect, useState } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}

export const Typewriter = ({ text, speed = 50, delay = 0, className = '' }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (delay > 0) {
      timeoutId = setTimeout(() => {
        startTyping();
      }, delay);
    } else {
      startTyping();
    }

    function startTyping() {
      let currentText = '';
      let index = 0;
      
      const intervalId = setInterval(() => {
        if (index < text.length) {
          currentText += text[index];
          setDisplayedText(currentText);
          index++;
        } else {
          clearInterval(intervalId);
          setComplete(true);
        }
      }, speed);

      // Cleanup nested interval
      return () => clearInterval(intervalId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, delay]);

  return (
    <span className={className}>
      {displayedText}
      {!complete && <span className="typewriter-cursor">|</span>}
    </span>
  );
};
