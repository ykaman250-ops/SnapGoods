import { useEffect, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollPreservation(ref: RefObject<HTMLElement>, key: string) {
  const location = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Restore scroll position
    const saved = sessionStorage.getItem(`scroll_${key}`);
    if (saved !== null) {
      el.scrollTop = parseInt(saved, 10);
    }

    // Save scroll position on unmount or before navigating
    // Using a simple event listener on scroll to save continuously is easier
    // and handles unmount perfectly
    const handleScroll = () => {
      sessionStorage.setItem(`scroll_${key}`, el.scrollTop.toString());
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [key, location.pathname, ref]);
}
