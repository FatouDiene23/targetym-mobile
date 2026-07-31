"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

/** Même détection que CustomSelect — voir components/CustomSelect.tsx. */
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

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? `${t.common.search}...`;
  const resolvedSearchPlaceholder = searchPlaceholder ?? t.common.searchPlaceholder;
  const resolvedEmptyLabel = emptyLabel ?? t.common.noResults;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isNative, setIsNative] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    detectNativePlatform().then(setIsNative);
  }, []);

  const lowerSearch = search.toLowerCase();
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(lowerSearch) ||
    (o.subtitle && o.subtitle.toLowerCase().includes(lowerSearch))
  );

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          const willOpen = !open;
          setOpen(willOpen);
          setSearch('');
          // Sur mobile le panneau s'insère dans le flux : on ramène le champ
          // dans la vue pour qu'il ne parte pas sous le clavier.
          if (willOpen && isNative) {
            setTimeout(() => {
              triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }
        }}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between transition-colors ${
          disabled
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'bg-white hover:border-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none'
        }`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 ml-2 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={
            isNative
              // En flux sur mobile : le panneau pousse le contenu au lieu de le
              // recouvrir, comme CustomSelect.
              ? 'relative mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden'
              : 'absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden'
          }
        >
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 bg-gray-50 rounded-md px-2 py-1.5">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={resolvedSearchPlaceholder}
                className="flex-1 text-sm outline-none bg-transparent"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  <X size={12} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-primary-50 text-primary-700' : 'text-gray-400'}`}
            >
              {resolvedPlaceholder}
            </button>
            {filtered.length > 0 ? filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  o.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                }`}
              >
                <span>{o.label}</span>
                {o.subtitle && <span className="text-xs text-gray-400 ml-1">— {o.subtitle}</span>}
              </button>
            )) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">{resolvedEmptyLabel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
