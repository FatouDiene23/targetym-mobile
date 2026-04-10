'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

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

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  className = '',
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption?.label ?? '';

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={`truncate ${displayLabel ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${open && !isMobile ? 'rotate-180' : ''}`}
        />
      </button>

      {/* MOBILE : Bottom Sheet */}
      {open && isMobile && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[200]" onClick={() => setOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[201] max-h-[65vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-gray-900 text-base">{placeholder}</span>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-4 text-left transition-colors
                    ${opt.disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 active:bg-gray-100'}
                    ${opt.value === value ? 'text-primary-600 font-semibold' : 'text-gray-800'}`}
                >
                  <span className="text-base">{opt.label}</span>
                  {opt.value === value && <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* DESKTOP : Dropdown */}
      {open && !isMobile && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => !opt.disabled && handleSelect(opt.value)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors
                ${opt.disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}
                ${opt.value === value ? 'text-primary-600 font-medium bg-primary-50/60' : 'text-gray-700'}`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
