'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  emptyLabel = 'Aucun résultat',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUpward = spaceBelow < 120 && spaceAbove > spaceBelow;
      const top = openUpward
        ? rect.top - Math.min(240, spaceAbove) - 4
        : rect.bottom + 4;
      setPosition({ top, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  const filtered = options.filter(o =>
    !search ||
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(o => o.value === value);

  const dropdown = open && mounted ? createPortal(
    <>
      {/* overlay transparent — ferme le dropdown au tap extérieur */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99997 }}
        onClick={() => { setOpen(false); setSearch(''); }}
      />
      <div
        style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px`, zIndex: 99999 }}
        className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
      >
        <div className="p-2 border-b bg-gray-50">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2 py-1.5">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 hover:bg-gray-100 rounded">
                <X size={11} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(o => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); setSearch(''); } }}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 transition-colors
                ${o.disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 active:bg-gray-100'}
                ${o.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-800'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.subtitle && <span className="text-xs text-gray-400">{o.subtitle}</span>}
                </div>
                {o.value === value && <Check size={14} className="text-primary-600 flex-shrink-0" />}
              </div>
            </button>
          )) : (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">{emptyLabel}</div>
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
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(''); } }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}