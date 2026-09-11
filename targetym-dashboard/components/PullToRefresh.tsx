'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

interface PullToRefreshProps {
  children: React.ReactNode;
  className?: string;
  // Callback optionnel de rafraîchissement custom. Par défaut : reload complet
  // de la page, qui garantit un refresh cohérent sur n'importe quel écran du
  // dashboard sans avoir à instrumenter chaque page individuellement.
  onRefresh?: () => void | Promise<void>;
}

export default function PullToRefresh({ children, className = '', onRefresh }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const gesture = useRef({ startY: 0, pulling: false });
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(PULL_THRESHOLD);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
        return;
      }
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop <= 0) {
        gesture.current.pulling = true;
        gesture.current.startY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.current.pulling || refreshing) return;
      if (el.scrollTop > 0) {
        gesture.current.pulling = false;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - gesture.current.startY;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Empêche le rebond natif iOS/Android pendant le tirage pour éviter un
      // double mouvement (rebond natif + indicateur custom qui se superposent).
      e.preventDefault();
      setPullDistance(Math.min(delta * 0.5, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (!gesture.current.pulling) return;
      gesture.current.pulling = false;
      setPullDistance(current => {
        if (current >= PULL_THRESHOLD) {
          triggerRefresh();
          return current;
        }
        return 0;
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [refreshing, triggerRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = pullDistance > 0 || refreshing;

  return (
    <>
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-md border border-gray-100"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          opacity: showIndicator ? progress : 0,
          transition: gesture.current.pulling ? 'none' : 'opacity 0.2s ease-out',
        }}
        aria-hidden="true"
      >
        <RefreshCw
          className={`w-4 h-4 text-primary-500 ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 360}deg)` }}
        />
      </div>
      <main
        ref={scrollRef as React.RefObject<HTMLElement>}
        className={className}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: gesture.current.pulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </main>
    </>
  );
}
