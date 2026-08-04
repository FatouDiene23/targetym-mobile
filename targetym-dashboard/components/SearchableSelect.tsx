"use client";

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

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
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      // Largeur : au moins celle du trigger, au moins 220px, pas plus que l'écran
      const dropWidth = Math.min(Math.max(rect.width, 220), viewportWidth - 16);
      // Recadre à gauche si déborde à droite
      const left = Math.min(rect.left, viewportWidth - dropWidth - 8);
      if (spaceBelow < 150 && spaceAbove > spaceBelow) {
        const maxH = Math.min(280, spaceAbove);
        setPosition({ top: rect.top - maxH - 4, left, width: dropWidth, maxHeight: maxH });
      } else {
        setPosition({ top: rect.bottom + 4, left, width: dropWidth, maxHeight: Math.max(spaceBelow, 150) });
      }
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
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const lowerSearch = search.toLowerCase();
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(lowerSearch) ||
    (o.subtitle && o.subtitle.toLowerCase().includes(lowerSearch))
  );

  const selected = options.find(o => o.value === value);

  const close = () => { setOpen(false); setSearch(''); };

  const dropdown = open && mounted ? createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99997 }} onClick={close} />
      <div
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
          maxHeight: `${position.maxHeight}px`,
          zIndex: 99999,
        }}
        className="bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-2 border-b flex-shrink-0">
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
              <button type="button" onClick={() => setSearch('')} className="p-0.5 hover:bg-gray-200 rounded">
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); close(); }}
            className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 ${!value ? 'bg-primary-50 text-primary-700' : 'text-gray-400'}`}
          >
            {resolvedPlaceholder}
          </button>
          {filtered.length > 0 ? filtered.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); close(); }}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
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
    </>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        style={open ? { position: 'relative', zIndex: 99998 } : undefined}
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between transition-colors ${
          open ? 'border-primary-500 ring-2 ring-primary-500/20' : ''
        } ${
          disabled
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'bg-white hover:border-gray-400 outline-none'
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
      {dropdown}
    </div>
  );
}
