'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { calendarTips } from '@/config/pageTips';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, Grid3X3, LayoutGrid,
  AlertCircle, Filter, Cake, Plane, GraduationCap, Users, Coffee,
  UserCheck, PartyPopper, Clock, RefreshCw, CalendarDays, Star, X,
  Briefcase, Heart
} from 'lucide-react';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  employee_id?: number;
  role?: string;
  is_manager?: boolean;
  first_name?: string;
  last_name?: string;
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  manager_id?: number;
  date_of_birth?: string;
  hire_date?: string;
  status?: string;
  trial_end_date?: string;
  trial_status?: string;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason?: string;
}

interface Mission {
  id: number;
  employee_id?: number;
  employee_name?: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
}

type EventType = 'my_leave' | 'team_leave' | 'birthday' | 'work_anniversary' | 'company_event' | 'mission' | 'training' | 'one_on_one' | 'get_to_know' | 'trial_end' | 'holiday';

interface CalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  endDate?: string;
  type: EventType;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  allDay?: boolean;
  details?: string;
}

type ViewMode = 'month' | 'week' | 'list';

// ============================================
// EVENT TYPE CONFIG
// ============================================

const EVENT_STYLES: Record<EventType, { color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  my_leave:        { color: 'text-blue-700',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-200',   dotColor: 'bg-blue-500' },
  team_leave:      { color: 'text-sky-700',     bgColor: 'bg-sky-50',      borderColor: 'border-sky-200',    dotColor: 'bg-sky-400' },
  birthday:        { color: 'text-pink-700',    bgColor: 'bg-pink-50',     borderColor: 'border-pink-200',   dotColor: 'bg-pink-500' },
  work_anniversary:{ color: 'text-amber-700',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-200',  dotColor: 'bg-amber-500' },
  company_event:   { color: 'text-purple-700',  bgColor: 'bg-purple-50',   borderColor: 'border-purple-200', dotColor: 'bg-purple-500' },
  mission:         { color: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200',dotColor: 'bg-emerald-500' },
  training:        { color: 'text-indigo-700',  bgColor: 'bg-indigo-50',   borderColor: 'border-indigo-200', dotColor: 'bg-indigo-500' },
  one_on_one:      { color: 'text-teal-700',    bgColor: 'bg-teal-50',     borderColor: 'border-teal-200',   dotColor: 'bg-teal-500' },
  get_to_know:     { color: 'text-orange-700',  bgColor: 'bg-orange-50',   borderColor: 'border-orange-200', dotColor: 'bg-orange-500' },
  trial_end:       { color: 'text-red-700',     bgColor: 'bg-red-50',      borderColor: 'border-red-200',    dotColor: 'bg-red-500' },
  holiday:         { color: 'text-gray-700',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-200',   dotColor: 'bg-gray-500' },
};

function getEventLabels(t: ReturnType<typeof useI18n>['t']): Record<EventType, string> {
  return {
    my_leave: t.mySpace.calendar.myLeave,
    team_leave: t.mySpace.calendar.teamLeave,
    birthday: t.mySpace.calendar.birthdaysLabel,
    work_anniversary: t.mySpace.calendar.workAnniversaries,
    company_event: t.mySpace.calendar.companyEvents,
    mission: t.mySpace.calendar.missions,
    training: t.mySpace.calendar.trainings,
    one_on_one: t.mySpace.calendar.oneOnOne,
    get_to_know: t.mySpace.calendar.getToKnow,
    trial_end: t.mySpace.calendar.trialEnd,
    holiday: t.mySpace.calendar.holidaysLabel,
  };
}

// Backward compat: build a full EVENT_CONFIGS-like object with label included
function getEventConfigs(t: ReturnType<typeof useI18n>['t']): Record<EventType, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> {
  const labels = getEventLabels(t);
  const result: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {};
  for (const [key, style] of Object.entries(EVENT_STYLES)) {
    result[key] = { ...style, label: labels[key as EventType] };
  }
  return result as Record<EventType, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }>;
}

function getEventIcon(type: EventType, className: string = 'w-3.5 h-3.5') {
  const icons: Record<EventType, React.ReactNode> = {
    my_leave:         <CalendarDays className={className} />,
    team_leave:       <Users className={className} />,
    birthday:         <Cake className={className} />,
    work_anniversary: <Heart className={className} />,
    company_event:    <PartyPopper className={className} />,
    mission:          <Plane className={className} />,
    training:         <GraduationCap className={className} />,
    one_on_one:       <Coffee className={className} />,
    get_to_know:      <UserCheck className={className} />,
    trial_end:        <AlertCircle className={className} />,
    holiday:          <Star className={className} />,
  };
  return icons[type];
}

// ============================================
// SENEGAL PUBLIC HOLIDAYS (configurable)
// ============================================

function getPublicHolidays(year: number, t: ReturnType<typeof useI18n>['t']): { date: string; name: string }[] {
  return [
    { date: `${year}-01-01`, name: t.mySpace.calendar.newYear },
    { date: `${year}-04-04`, name: t.mySpace.calendar.independenceDay },
    { date: `${year}-05-01`, name: t.mySpace.calendar.laborDay },
    { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
    { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    { date: `${year}-12-25`, name: t.mySpace.calendar.christmas },
  ];
}

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}&page_size=100`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

async function getTeamLeaveRequests(managerId: number): Promise<LeaveRequest[]> {
  try {
    const response = await fetch(`${API_URL}/api/leaves/requests?manager_id=${managerId}&status=approved&page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  } catch {
    return [];
  }
}

async function getEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.employees)) return data.employees;
    return [];
  } catch {
    return [];
  }
}

async function getMyMissions(employeeId: number): Promise<Mission[]> {
  try {
    const response = await fetch(`${API_URL}/api/missions/?employee_id=${employeeId}&page_size=50`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.missions)) return data.missions;
    return [];
  } catch {
    return [];
  }
}

async function getTeamMembers(managerId: number): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?manager_id=${managerId}&page_size=50`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.employees)) return data.employees;
    return [];
  } catch {
    return [];
  }
}

// ============================================
// DATE HELPERS
// ============================================

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isSameDay(d1: string, d2: string): boolean {
  return d1.substring(0, 10) === d2.substring(0, 10);
}

function isDateInRange(date: string, start: string, end: string): boolean {
  const d = date.substring(0, 10);
  const s = start.substring(0, 10);
  const e = end.substring(0, 10);
  return d >= s && d <= e;
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getMonthNames(t: ReturnType<typeof useI18n>['t']): string[] {
  return [t.mySpace.calendar.january, t.mySpace.calendar.february, t.mySpace.calendar.march, t.mySpace.calendar.april, t.mySpace.calendar.may, t.mySpace.calendar.june, t.mySpace.calendar.july, t.mySpace.calendar.august, t.mySpace.calendar.september, t.mySpace.calendar.october, t.mySpace.calendar.november, t.mySpace.calendar.december];
}

function getDayNames(t: ReturnType<typeof useI18n>['t']): string[] {
  return [t.mySpace.calendar.monday, t.mySpace.calendar.tuesday, t.mySpace.calendar.wednesday, t.mySpace.calendar.thursday, t.mySpace.calendar.friday, t.mySpace.calendar.saturday, t.mySpace.calendar.sunday];
}

function getDayNamesFull(t: ReturnType<typeof useI18n>['t']): string[] {
  return [t.mySpace.calendar.mondayFull, t.mySpace.calendar.tuesdayFull, t.mySpace.calendar.wednesdayFull, t.mySpace.calendar.thursdayFull, t.mySpace.calendar.fridayFull, t.mySpace.calendar.saturdayFull, t.mySpace.calendar.sundayFull];
}

// ============================================
// BUILD EVENTS FROM DATA
// ============================================

function buildCalendarEvents(
  myLeaves: LeaveRequest[],
  teamLeaves: LeaveRequest[],
  employees: Employee[],
  teamMembers: Employee[],
  myMissions: Mission[],
  currentEmployeeId: number,
  userRole: string,
  isManager: boolean,
  currentYear: number,
  currentMonth: number,
  t: ReturnType<typeof useI18n>['t'],
): CalendarEvent[] {
  const EVENT_CONFIGS = getEventConfigs(t);
  const events: CalendarEvent[] = [];

  // --- My leaves (approved + pending) ---
  myLeaves
    .filter(l => l.status === 'approved' || l.status === 'pending')
    .forEach(leave => {
      const config = EVENT_CONFIGS.my_leave;
      events.push({
        id: `leave-${leave.id}`,
        title: leave.leave_type_name || t.mySpace.calendar.leave,
        subtitle: leave.status === 'pending' ? t.mySpace.calendar.pendingStatus : t.mySpace.calendar.approved,
        date: leave.start_date,
        endDate: leave.end_date,
        type: 'my_leave',
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor,
        icon: getEventIcon('my_leave'),
        allDay: true,
        details: `${leave.days_requested} ${t.mySpace.calendar.days}${leave.reason ? ` — ${leave.reason}` : ''}`,
      });
    });

  // --- Team leaves (if manager) ---
  if (isManager || ['rh', 'admin', 'dg'].includes(userRole)) {
    teamLeaves
      .filter(l => l.employee_id !== currentEmployeeId && l.status === 'approved')
      .forEach(leave => {
        const config = EVENT_CONFIGS.team_leave;
        events.push({
          id: `team-leave-${leave.id}`,
          title: `${leave.employee_name || t.mySpace.calendar.collaborator} — ${leave.leave_type_name || t.mySpace.calendar.leave}`,
          date: leave.start_date,
          endDate: leave.end_date,
          type: 'team_leave',
          color: config.color,
          bgColor: config.bgColor,
          borderColor: config.borderColor,
          icon: getEventIcon('team_leave'),
          allDay: true,
          details: `${leave.days_requested} ${t.mySpace.calendar.days}`,
        });
      });
  }

  // --- Birthdays (same department or team) ---
  const relevantEmployees = isManager || ['rh', 'admin', 'dg'].includes(userRole) 
    ? employees 
    : teamMembers.length > 0 ? teamMembers : employees;

  relevantEmployees.forEach(emp => {
    if (!emp.date_of_birth || emp.status !== 'active') return;
    const dob = emp.date_of_birth.substring(5); // MM-DD
    const birthdayDate = `${currentYear}-${dob}`;
    const config = EVENT_CONFIGS.birthday;
    events.push({
      id: `bday-${emp.id}-${currentYear}`,
      title: `🎂 ${emp.first_name} ${emp.last_name}`,
      subtitle: emp.job_title || emp.department_name || '',
      date: birthdayDate,
      type: 'birthday',
      color: config.color,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      icon: getEventIcon('birthday'),
      allDay: true,
    });
  });

  // --- Work anniversaries ---
  relevantEmployees.forEach(emp => {
    if (!emp.hire_date || emp.status !== 'active') return;
    const hireMMDD = emp.hire_date.substring(5);
    const anniversaryDate = `${currentYear}-${hireMMDD}`;
    const hireYear = parseInt(emp.hire_date.substring(0, 4));
    const yearsOfService = currentYear - hireYear;
    if (yearsOfService <= 0) return;
    
    const config = EVENT_CONFIGS.work_anniversary;
    events.push({
      id: `anniv-${emp.id}-${currentYear}`,
      title: `🎉 ${emp.first_name} ${emp.last_name}`,
      subtitle: `${yearsOfService} ${t.mySpace.calendar.yearsInCompany}`,
      date: anniversaryDate,
      type: 'work_anniversary',
      color: config.color,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      icon: getEventIcon('work_anniversary'),
      allDay: true,
    });
  });

  // --- My missions ---
  myMissions
    .filter(m => m.status !== 'cancelled')
    .forEach(mission => {
      const config = EVENT_CONFIGS.mission;
      events.push({
        id: `mission-${mission.id}`,
        title: `Mission — ${mission.destination}`,
        subtitle: mission.status,
        date: mission.start_date,
        endDate: mission.end_date,
        type: 'mission',
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor,
        icon: getEventIcon('mission'),
        allDay: true,
      });
    });

  // --- Trial period endings (manager/RH only) ---
  if (isManager || ['rh', 'admin', 'dg'].includes(userRole)) {
    const targetEmployees = isManager && !['rh', 'admin', 'dg'].includes(userRole) ? teamMembers : employees;
    targetEmployees.forEach(emp => {
      if (!emp.trial_end_date || emp.trial_status === 'validated') return;
      const config = EVENT_CONFIGS.trial_end;
      events.push({
        id: `trial-${emp.id}`,
        title: `⚠️ Fin essai — ${emp.first_name} ${emp.last_name}`,
        subtitle: emp.job_title || '',
        date: emp.trial_end_date,
        type: 'trial_end',
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor,
        icon: getEventIcon('trial_end'),
        allDay: true,
        details: t.mySpace.calendar.trialToEvaluate,
      });
    });
  }

  // --- Public holidays ---
  const holidays = getPublicHolidays(currentYear, t);
  holidays.forEach((h, i) => {
    const config = EVENT_CONFIGS.holiday;
    events.push({
      id: `holiday-${i}`,
      title: `🏛️ ${h.name}`,
      date: h.date,
      type: 'holiday',
      color: config.color,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      icon: getEventIcon('holiday'),
      allDay: true,
    });
  });

  return events;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function EventPill({ event, compact = false, onClick }: { event: CalendarEvent; compact?: boolean; onClick?: () => void }) {
  const { t } = useI18n();
  const EVENT_CONFIGS = getEventConfigs(t);
  const config = EVENT_CONFIGS[event.type];
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium truncate ${config.bgColor} ${config.color} border ${config.borderColor} hover:opacity-80 transition-opacity`}
        title={event.title}
      >
        {event.title}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor} hover:opacity-80 transition-opacity`}
    >
      <span className="shrink-0">{event.icon}</span>
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function EventDetailModal({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  const { t } = useI18n();
  const EVENT_CONFIGS = getEventConfigs(t);
  if (!event) return null;
  const config = EVENT_CONFIGS[event.type];
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color} mb-4`}>
            {getEventIcon(event.type, 'w-4 h-4')}
            {config.label}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.title}</h3>
          {event.subtitle && <p className="text-sm text-gray-500 mb-3">{event.subtitle}</p>}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <span>
              {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {event.endDate && event.endDate !== event.date && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{t.mySpace.calendar.untilDate} {new Date(event.endDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {event.details && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{event.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ activeFilters, onToggle }: { activeFilters: Set<EventType>; onToggle: (t: EventType) => void }) {
  const { t: tr } = useI18n();
  const EVENT_CONFIGS = getEventConfigs(tr);
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(EVENT_CONFIGS) as [EventType, typeof EVENT_CONFIGS[EventType]][]).map(([type, config]) => {
        const active = activeFilters.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              active
                ? `${config.bgColor} ${config.color} ${config.borderColor}`
                : 'bg-gray-100 text-gray-400 border-gray-200 opacity-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${active ? config.dotColor : 'bg-gray-300'}`} />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// MONTH VIEW
// ============================================

function MonthView({ year, month, events, onEventClick }: {
  year: number; month: number; events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void;
}) {
  const { t } = useI18n();
  const DAY_NAMES = getDayNames(t);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = formatDate(new Date());
  
  const prevMonthDays = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);
  
  const cells: { day: number; currentMonth: boolean; dateStr: string }[] = [];
  
  // Previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  
  // Next month
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ day: d, currentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  function getEventsForDate(dateStr: string): CalendarEvent[] {
    return events.filter(e => {
      if (e.endDate && e.endDate !== e.date) {
        return isDateInRange(dateStr, e.date, e.endDate);
      }
      return isSameDay(dateStr, e.date);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_NAMES.map(name => (
          <div key={name} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {name}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isToday = cell.dateStr === today;
          const dayEvents = getEventsForDate(cell.dateStr);
          const isWeekend = idx % 7 >= 5;
          
          return (
            <div 
              key={idx}
              className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 transition-colors ${
                !cell.currentMonth ? 'bg-gray-50/50' : isWeekend ? 'bg-gray-50/30' : 'bg-white'
              } ${isToday ? 'ring-2 ring-inset ring-primary-500/30' : ''}`}
            >
              <div className={`text-right mb-1 ${!cell.currentMonth ? 'text-gray-300' : ''}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                  isToday 
                    ? 'bg-primary-500 text-white rounded-full font-bold' 
                    : cell.currentMonth ? 'text-gray-700 font-medium' : 'text-gray-300'
                }`}>
                  {cell.day}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <EventPill key={event.id} event={event} compact onClick={() => onEventClick(event)} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} {t.mySpace.calendar.more}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// WEEK VIEW
// ============================================

function WeekView({ weekDates, events, onEventClick }: {
  weekDates: Date[]; events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void;
}) {
  const { t } = useI18n();
  const DAY_NAMES_FULL = getDayNamesFull(t);
  const today = formatDate(new Date());

  function getEventsForDate(dateStr: string): CalendarEvent[] {
    return events.filter(e => {
      if (e.endDate && e.endDate !== e.date) {
        return isDateInRange(dateStr, e.date, e.endDate);
      }
      return isSameDay(dateStr, e.date);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {weekDates.map((date, idx) => {
          const dateStr = formatDate(date);
          const isToday = dateStr === today;
          const dayEvents = getEventsForDate(dateStr);
          const isWeekend = idx >= 5;

          return (
            <div 
              key={idx} 
              className={`min-h-[400px] ${isToday ? 'bg-primary-50/30' : isWeekend ? 'bg-gray-50/30' : ''}`}
            >
              <div className={`sticky top-0 px-3 py-3 text-center border-b border-gray-200 ${isToday ? 'bg-primary-50' : 'bg-gray-50'}`}>
                <div className="text-xs font-medium text-gray-500 uppercase">{DAY_NAMES_FULL[idx]}</div>
                <div className={`text-lg mt-0.5 ${
                  isToday ? 'bg-primary-500 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold' : 'font-semibold text-gray-900'
                }`}>
                  {date.getDate()}
                </div>
              </div>
              <div className="p-2 space-y-1.5">
                {dayEvents.map(event => (
                  <EventPill key={event.id} event={event} onClick={() => onEventClick(event)} />
                ))}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-gray-300 text-center pt-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// LIST VIEW
// ============================================

function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
  const { t } = useI18n();
  const EVENT_CONFIGS = getEventConfigs(t);
  // Group events by date
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    events.forEach(event => {
      const dateKey = event.date.substring(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
      
      // For multi-day events, also add to end date
      if (event.endDate && event.endDate !== event.date) {
        const endKey = event.endDate.substring(0, 10);
        if (endKey !== dateKey) {
          if (!map.has(endKey)) map.set(endKey, []);
          // Avoid duplicates
          if (!map.get(endKey)!.find(e => e.id === event.id)) {
            map.get(endKey)!.push(event);
          }
        }
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, evts]) => evts.length > 0);
  }, [events]);

  const today = formatDate(new Date());

  if (grouped.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{t.mySpace.calendar.noEventsForPeriod}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([dateStr, dayEvents]) => {
        const date = new Date(dateStr + 'T00:00:00');
        const isToday = dateStr === today;
        const isPast = dateStr < today;

        return (
          <div key={dateStr} className={`bg-white rounded-xl border ${isToday ? 'border-primary-300 ring-1 ring-primary-100' : 'border-gray-200'} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-5 py-3 border-b ${isToday ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center ${
                isToday ? 'bg-primary-500 text-white' : isPast ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-700 border border-gray-200'
              }`}>
                <span className="text-[10px] font-semibold uppercase leading-none mt-0.5">
                  {date.toLocaleDateString('fr-FR', { month: 'short' })}
                </span>
                <span className="text-sm font-bold leading-none">{date.getDate()}</span>
              </div>
              <div>
                <span className={`text-sm font-semibold ${isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                  {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {isToday && <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{t.mySpace.calendar.todayBtn}</span>}
              </div>
              <span className="ml-auto text-xs text-gray-400 font-medium">{dayEvents.length} {t.mySpace.calendar.eventCount}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {dayEvents.map(event => {
                const config = EVENT_CONFIGS[event.type];
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-1 h-10 rounded-full ${config.dotColor}`} />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                      {getEventIcon(event.type, 'w-4 h-4 ' + config.color)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      {event.subtitle && <p className="text-xs text-gray-500 truncate">{event.subtitle}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyCalendarPage() {
  const { t } = useI18n();
  const EVENT_CONFIGS = getEventConfigs(t);
  const MONTH_NAMES = getMonthNames(t);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set(Object.keys(EVENT_CONFIGS) as EventType[]));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { showTips, dismissTips, resetTips } = usePageTour('calendar');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError(t.mySpace.calendar.accountNotLinked);
        return;
      }

      const userStr = localStorage.getItem('user');
      let userRole = user.role?.toLowerCase() || 'employee';
      let isManager = user.is_manager || false;
      
      if (userStr) {
        try {
          const ud = JSON.parse(userStr);
          userRole = ud.role?.toLowerCase() || userRole;
          isManager = ud.is_manager || isManager;
        } catch { /* ignore */ }
      }

      const [myLeaves, employees, myMissions] = await Promise.all([
        getMyLeaveRequests(user.employee_id),
        getEmployees(),
        getMyMissions(user.employee_id),
      ]);

      // Safety: ensure all are arrays
      const safeMyLeaves = Array.isArray(myLeaves) ? myLeaves : [];
      const safeEmployees = Array.isArray(employees) ? employees : [];
      const safeMyMissions = Array.isArray(myMissions) ? myMissions : [];

      // Get team data if manager
      let teamLeaves: LeaveRequest[] = [];
      let teamMembers: Employee[] = [];
      if (isManager || ['rh', 'admin', 'dg'].includes(userRole)) {
        const [tl, tm] = await Promise.all([
          getTeamLeaveRequests(user.employee_id),
          getTeamMembers(user.employee_id),
        ]);
        teamLeaves = Array.isArray(tl) ? tl : [];
        teamMembers = Array.isArray(tm) ? tm : [];
      }

      const events = buildCalendarEvents(
        safeMyLeaves, teamLeaves, safeEmployees, teamMembers,
        safeMyMissions, user.employee_id, userRole, isManager,
        currentYear, currentMonth, t,
      );

      setAllEvents(events);
    } catch (err) {
      console.error(err);
      setError(t.mySpace.calendar.loadingError);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  
  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const toggleFilter = (type: EventType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => activeFilters.has(e.type));
  }, [allEvents, activeFilters]);

  // Filter events for current view period
  const visibleEvents = useMemo(() => {
    if (viewMode === 'month') {
      const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const endDay = getDaysInMonth(currentYear, currentMonth);
      const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      return filteredEvents.filter(e => {
        const eDate = e.date.substring(0, 10);
        const eEnd = (e.endDate || e.date).substring(0, 10);
        return eEnd >= startStr && eDate <= endStr;
      });
    }
    
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      const startStr = formatDate(weekDates[0]);
      const endStr = formatDate(weekDates[6]);
      
      return filteredEvents.filter(e => {
        const eDate = e.date.substring(0, 10);
        const eEnd = (e.endDate || e.date).substring(0, 10);
        return eEnd >= startStr && eDate <= endStr;
      });
    }
    
    // List view: show all for the month
    const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDay = getDaysInMonth(currentYear, currentMonth);
    const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    return filteredEvents.filter(e => {
      const eDate = e.date.substring(0, 10);
      const eEnd = (e.endDate || e.date).substring(0, 10);
      return eEnd >= startStr && eDate <= endStr;
    });
  }, [filteredEvents, viewMode, currentDate, currentYear, currentMonth]);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // Title
  const viewTitle = useMemo(() => {
    if (viewMode === 'week') {
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} — ${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
      }
      return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0, 3)} — ${end.getDate()} ${MONTH_NAMES[end.getMonth()].substring(0, 3)} ${end.getFullYear()}`;
    }
    return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }, [viewMode, currentMonth, currentYear, weekDates]);

  // Stats
  const eventCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleEvents.forEach(e => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [visibleEvents]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{t.mySpace.calendar.loadingCalendar}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips tips={calendarTips} onDismiss={dismissTips} pageTitle={t.mySpace.calendar.title} />
      )}
<<<<<<< HEAD
      <Header title={t.mySpace.calendar.title} subtitle={t.mySpace.calendar.subtitle} />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-4 mb-6">
=======
      <div className="py-4 px-2 sm:px-4 lg:px-8">
      <div className="max-w-full lg:max-w-7xl mx-auto overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-lg lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary-600" />
              Mon Calendrier
            </h1>
            <p className="text-gray-500 mt-1">Vos événements, congés et rendez-vous importants</p>
          </div>
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t.mySpace.calendar.refresh}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t.mySpace.calendar.filterBtn}
              {activeFilters.size < Object.keys(EVENT_CONFIGS).length && (
                <span className="bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilters.size}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{t.mySpace.calendar.filterByEventType}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveFilters(new Set(Object.keys(EVENT_CONFIGS) as EventType[]))}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {t.mySpace.calendar.showAll}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setActiveFilters(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  {t.mySpace.calendar.hideAll}
                </button>
              </div>
            </div>
            <Legend activeFilters={activeFilters} onToggle={toggleFilter} />
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-4 lg:mb-6" data-tour="calendar-view">
          {[
<<<<<<< HEAD
            { label: t.mySpace.calendar.events, value: visibleEvents.length, icon: <CalendarIcon className="w-4 h-4" />, color: 'text-primary-600 bg-primary-50' },
            { label: t.mySpace.calendar.leaves, value: (eventCountByType['my_leave'] || 0) + (eventCountByType['team_leave'] || 0), icon: <Briefcase className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
            { label: t.mySpace.calendar.birthdays, value: (eventCountByType['birthday'] || 0) + (eventCountByType['work_anniversary'] || 0), icon: <Cake className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
            { label: t.mySpace.calendar.holidays, value: eventCountByType['holiday'] || 0, icon: <Star className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
=======
            { label: 'Événements', value: visibleEvents.length, icon: <CalendarIcon className="w-4 h-4" />, color: 'text-primary-600 bg-primary-50' },
            { label: 'Congés', value: (eventCountByType['my_leave'] || 0) + (eventCountByType['team_leave'] || 0), icon: <Briefcase className="w-4 h-4" />, color: 'text-primary-600 bg-primary-50' },
            { label: 'Anniv.', value: (eventCountByType['birthday'] || 0) + (eventCountByType['work_anniversary'] || 0), icon: <Cake className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
            { label: 'Fériés', value: eventCountByType['holiday'] || 0, icon: <Star className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToday}
              className="px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors whitespace-nowrap"
            >
<<<<<<< HEAD
              {t.mySpace.calendar.todayBtn}
=======
              Auj.
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d
            </button>
            <button onClick={goPrev} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            <button onClick={goNext} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            <h2 className="text-sm lg:text-lg font-semibold text-gray-900 ml-1 truncate max-w-[130px] lg:max-w-none">{viewTitle}</h2>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {([
<<<<<<< HEAD
              { key: 'month', label: t.mySpace.calendar.monthView, icon: <Grid3X3 className="w-4 h-4" /> },
              { key: 'week', label: t.mySpace.calendar.weekView, icon: <LayoutGrid className="w-4 h-4" /> },
              { key: 'list', label: t.mySpace.calendar.listView, icon: <List className="w-4 h-4" /> },
=======
              { key: 'month', label: 'Mois', icon: <Grid3X3 className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> },
              { key: 'week', label: 'Sem.', icon: <LayoutGrid className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> },
              { key: 'list', label: 'Liste', icon: <List className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> },
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d
            ] as { key: ViewMode; label: string; icon: React.ReactNode }[]).map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`flex items-center gap-1 px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-md transition-all ${
                  viewMode === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'month' && (
          <MonthView 
            year={currentYear} 
            month={currentMonth} 
            events={visibleEvents} 
            onEventClick={setSelectedEvent} 
          />
        )}

        {viewMode === 'week' && (
          <WeekView 
            weekDates={weekDates} 
            events={visibleEvents} 
            onEventClick={setSelectedEvent} 
          />
        )}

        {viewMode === 'list' && (
          <ListView 
            events={visibleEvents} 
            onEventClick={setSelectedEvent} 
          />
        )}

        {/* Legend (always visible) */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.mySpace.calendar.legend}</h3>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(EVENT_CONFIGS) as [EventType, typeof EVENT_CONFIGS[EventType]][]).map(([type, config]) => (
              <div key={type} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                {config.label}
              </div>
            ))}
          </div>
        </div>

        {/* Event detail modal */}
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>
    </div>
    </>
  );
}
