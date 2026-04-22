'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
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

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  className = '',
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    detectNativePlatform().then(setIsNative);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selectedOption = options.find(o => o.value === value);

  // Sur mobile natif (Capacitor), utiliser un dropdown INLINE qui pousse le contenu
  // au lieu de le recouvrir (pas de portail, pas de position fixed)
  if (isNative) {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            const willOpen = !open;
            setOpen(willOpen);
            if (willOpen && triggerRef.current) {
              // Scroll le trigger vers une position visible après un petit délai
              // pour laisser le dropdown se rendre
              setTimeout(() => {
                triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }
          }}
          className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
            ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300'}
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
        >
          <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-md max-h-48 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left border-b border-gray-50 last:border-0
                  ${opt.disabled ? 'text-gray-300' : 'active:bg-gray-100'}
                  ${opt.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-800'}`}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="w-4 h-4 text-primary-600 flex-shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        zIndex: 99999,
      }}
      className="bg-white border border-gray-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          onClick={() => { if (!opt.disabled) { onChange(opt.value); setOpen(false); } }}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors border-b border-gray-50 last:border-0
            ${opt.disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 active:bg-gray-100'}
            ${opt.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-800'}`}
        >
          <span>{opt.label}</span>
          {opt.value === value && <Check className="w-4 h-4 text-primary-600 flex-shrink-0 ml-2" />}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}
