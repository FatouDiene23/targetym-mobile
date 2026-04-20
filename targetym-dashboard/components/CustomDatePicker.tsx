'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CustomDatePicker({ value, onChange, placeholder = 'Sélectionner...', className = '', min, max, disabled = false }: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [viewDate, setViewDate] = useState(() => value ? new Date(value + 'T00:00:00') : new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPosition({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
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
    if (value) setViewDate(new Date(value + 'T00:00:00'));
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayIdx = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const minDate = min ? new Date(min + 'T00:00:00') : null;
  const maxDate = max ? new Date(max + 'T00:00:00') : null;
  const today = toISODate(new Date());
  const selected = value;

  function pickDay(d: number) {
    const date = new Date(year, month, d);
    const iso = toISODate(date);
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;
    onChange(iso);
    setOpen(false);
  }

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: `${position.width}px`,
        zIndex: 99999,
      }}
      className="bg-white border border-gray-300 rounded-lg shadow-2xl p-3"
    >
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="text-sm font-semibold text-gray-900">{MONTHS[month]} {year}</div>
        <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-[10px] font-semibold text-gray-500 text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const cellDate = new Date(year, month, d);
          const iso = toISODate(cellDate);
          const isSelected = iso === selected;
          const isToday = iso === today;
          const isDisabled = (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate);
          return (
            <button
              key={i}
              type="button"
              disabled={!!isDisabled}
              onClick={() => pickDay(d)}
              className={`text-xs rounded w-8 h-8 flex items-center justify-center transition-colors ${
                isDisabled ? 'text-gray-300 cursor-not-allowed' :
                isSelected ? 'bg-primary-500 text-white font-bold' :
                isToday ? 'bg-primary-50 text-primary-700 font-semibold' :
                'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
      </button>
      {dropdown}
    </div>
  );
}
