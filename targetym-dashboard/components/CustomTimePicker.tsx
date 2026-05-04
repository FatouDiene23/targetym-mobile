'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Pas en minutes (5, 10, 15, 30) */
  step?: number;
}

async function detectNativePlatform(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // Capacitor pas disponible → fallback
  }
  const proto = window.location.protocol;
  if (proto === 'capacitor:' || proto === 'file:') return true;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad/i.test(ua) && window.location.hostname === 'localhost';
}

function parseTime(v: string): { h: number; m: number } {
  if (!v || !v.includes(':')) return { h: 9, m: 0 };
  const [hh, mm] = v.split(':');
  return {
    h: Math.max(0, Math.min(23, parseInt(hh) || 0)),
    m: Math.max(0, Math.min(59, parseInt(mm) || 0)),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const ITEM_HEIGHT = 40;

export default function CustomTimePicker({
  value,
  onChange,
  placeholder = 'Sélectionner...',
  className = '',
  disabled = false,
  step = 5,
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [pendingH, setPendingH] = useState(9);
  const [pendingM, setPendingM] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detectNativePlatform().then(setIsNative);
  }, []);

  // Initialiser les valeurs en attente quand on ouvre
  useEffect(() => {
    if (open) {
      const { h, m } = parseTime(value);
      setPendingH(h);
      setPendingM(m);
    }
  }, [open, value]);

  // Centrer la valeur sélectionnée à l'ouverture
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (hoursRef.current) {
        hoursRef.current.scrollTop = pendingH * ITEM_HEIGHT;
      }
      if (minutesRef.current) {
        const idx = Math.floor(pendingM / step);
        minutesRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open]);

  const display = value || '';
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);

  const handleConfirm = () => {
    onChange(`${pad(pendingH)}:${pad(pendingM)}`);
    setOpen(false);
  };

  // Sur web (non-native), utiliser l'input time natif
  if (!isNative) {
    return (
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300'}
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={display ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {display || placeholder}
        </span>
        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Display de l'heure sélectionnée */}
          <div className="px-4 py-4 bg-gradient-to-b from-primary-50 to-white text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-primary-700 tabular-nums w-12 text-right">{pad(pendingH)}</span>
              <span className="text-3xl font-bold text-primary-300">:</span>
              <span className="text-3xl font-bold text-primary-700 tabular-nums w-12 text-left">{pad(pendingM)}</span>
            </div>
          </div>

          {/* Wheel picker container */}
          <div className="relative" style={{ height: `${ITEM_HEIGHT * 5}px` }}>
            {/* Bandeau de sélection central */}
            <div
              className="absolute inset-x-0 pointer-events-none border-y-2 border-primary-200 bg-primary-50/40 z-10"
              style={{
                top: `${ITEM_HEIGHT * 2}px`,
                height: `${ITEM_HEIGHT}px`,
              }}
            />
            {/* Gradient fade haut */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none z-20" />
            {/* Gradient fade bas */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-20" />

            <div className="flex h-full">
              {/* Colonne heures */}
              <div
                ref={hoursRef}
                className="flex-1 overflow-y-auto overscroll-contain scroll-smooth no-scrollbar"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'y mandatory',
                  paddingTop: `${ITEM_HEIGHT * 2}px`,
                  paddingBottom: `${ITEM_HEIGHT * 2}px`,
                }}
              >
                {hours.map((h) => {
                  const isSelected = h === pendingH;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setPendingH(h)}
                      className={`w-full flex items-center justify-center text-center tabular-nums transition-all duration-150 ${
                        isSelected
                          ? 'text-primary-700 font-bold text-xl'
                          : 'text-gray-400 text-base'
                      }`}
                      style={{
                        height: `${ITEM_HEIGHT}px`,
                        scrollSnapAlign: 'center',
                      }}
                    >
                      {pad(h)}
                    </button>
                  );
                })}
              </div>

              {/* Séparateur */}
              <div className="flex items-center justify-center px-2 text-2xl font-bold text-gray-300 select-none">:</div>

              {/* Colonne minutes */}
              <div
                ref={minutesRef}
                className="flex-1 overflow-y-auto overscroll-contain scroll-smooth no-scrollbar"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'y mandatory',
                  paddingTop: `${ITEM_HEIGHT * 2}px`,
                  paddingBottom: `${ITEM_HEIGHT * 2}px`,
                }}
              >
                {minutes.map((m) => {
                  const isSelected = m === pendingM;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPendingM(m)}
                      className={`w-full flex items-center justify-center text-center tabular-nums transition-all duration-150 ${
                        isSelected
                          ? 'text-primary-700 font-bold text-xl'
                          : 'text-gray-400 text-base'
                      }`}
                      style={{
                        height: `${ITEM_HEIGHT}px`,
                        scrollSnapAlign: 'center',
                      }}
                    >
                      {pad(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex border-t border-gray-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-3 text-sm font-medium text-gray-500 active:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 text-sm font-semibold text-primary-600 border-l border-gray-100 active:bg-primary-50 transition-colors"
            >
              Confirmer
            </button>
          </div>

          <style jsx>{`
            .no-scrollbar {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
