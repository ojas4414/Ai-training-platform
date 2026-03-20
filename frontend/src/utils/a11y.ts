/**
 * Accessibility Utilities
 * WCAG 2.1 Level AA compliance helpers
 */

/**
 * Generate unique ID for ARIA attributes
 */
export const generateId = (prefix = 'id'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Handle keyboard navigation for menu/dropdown components
 */
export const useKeyboardNav = (items: number) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = index === items - 1 ? 0 : index + 1;
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = index === 0 ? items - 1 : index - 1;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = items - 1;
        break;
      default:
        return index;
    }
    
    return newIndex;
  };

  return { handleKeyDown };
};

/**
 * Announce text to screen readers
 */
export const announceToScreenReader = (
  message: string, 
  priority: 'polite' | 'assertive' = 'polite'
) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Focus trap for modals and dialogs
 */
export const createFocusTrap = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  firstElement?.focus();
  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};



/**
 * Test if colors have sufficient contrast (WCAG)
 */
export const hasContrastRatio = (
  foreground: string,
  background: string,
  ratio: number = 4.5
): boolean => {
  const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const luminance =
      (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 1 : 0;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05) >= ratio;
};

/**
 * Reduce motion styles for animations
 */
export const getReducedMotionStyle = () => {
  if (typeof window === 'undefined') return {};
  
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  return prefersReducedMotion
    ? {
        animation: 'none',
        transition: 'none',
      }
    : {};
};
