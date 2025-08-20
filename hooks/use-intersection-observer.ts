// hooks/use-intersection-observer.ts
import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverProps {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  onIntersect: () => void;
  enabled?: boolean; // Permite activarea/dezactivarea observatorului
}

export function useIntersectionObserver({
  root,
  rootMargin = '0px',
  threshold = 1.0,
  onIntersect,
  enabled = true,
}: UseIntersectionObserverProps) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (!enabled || !target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [target, enabled, root, rootMargin, threshold, onIntersect]);

  return { setTarget };
}