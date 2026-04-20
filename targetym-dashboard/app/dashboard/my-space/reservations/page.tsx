'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Calendar, Clock, X, CheckCircle, ChevronRight,
  AlertCircle, DoorOpen, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import { useI18n } from '@/lib/i18n/I18nContext';
import { fetchWithAuth, API_URL } from '@/lib/api';

// ============ TYPES ============

interface Room {
  id: number;
  name: string;
  capacity: number;
  requires_validation: boolean;
  is_active: boolean;
}

interface Reservation {
  id: number;
  room_id: number;
  room_name: string;
  employee_id: number;
  employee_name: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'approuvee' | 'en_attente' | 'refusee' | 'annulee';
  refusal_reason?: string;
  validated_at?: string;
  created_at: string;
}

interface AvailableSlot {
  start_time: string;
  end_time: string;
}

type TabView = 'mes-reservations' | 'nouvelle';

// ============ HELPERS ============

const STATUS_BADGE: Record<string, string> = {
  approuvee: 'bg-green-100 text-green-700',
  en_attente: 'bg-yellow-100 text-yellow-700',
  refusee: 'bg-red-100 text-red-700',
  annulee: 'bg-gray-100 text-gray-600',
};

// STATUS_LABEL is now derived from i18n in the component

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ============ API ============

async function apiFetchRooms(): Promise<Room[]> {
  const res = await fetchWithAuth(`${API_URL}/api/rooms/`);
  if (!res.ok) throw new Error('Erreur chargement salles');
  return res.json();
}

async function apiFetchAvailability(roomId: number, date: string) {
  const res = await fetchWithAuth(`${API_URL}/api/rooms/${roomId}/availability?date=${date}`);
  if (!res.ok) throw new Error('Erreur disponibilité');
  return res.json() as Promise<{ reservations: { id: number; title: string; start_time: string; end_time: string; status: string }[]; available_slots: AvailableSlot[] }>;
}

async function apiFetchMyReservations(): Promise<Reservation[]> {
  const res = await fetchWithAuth(`${API_URL}/api/rooms/reservations/my`);
  if (!res.ok) throw new Error('Erreur chargement réservations');
  return res.json();
}

async function apiCreateReservation(data: { room_id: number; title: string; description?: string; start_time: string; end_time: string }) {
  const res = await fetchWithAuth(`${API_URL}/api/rooms/reservations`, { method: 'POST', body: JSON.stringify(data) });
  if (res.status === 409) {
    const err = await res.json();
    return { conflict: true, detail: err.detail } as const;
  }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(typeof e.detail === 'string' ? e.detail : 'Erreur création réservation'); }
  return { conflict: false, data: await res.json() as Reservation } as const;
}

async function apiCancel(id: number) {
  const res = await fetchWithAuth(`${API_URL}/api/rooms/reservations/${id}/cancel`, { method: 'POST' });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Erreur annulation'); }
}

// ============ COMPONENT ============

export default function MyReservationsPage() {
  const { t: i18n } = useI18n();
  const STATUS_LABEL: Record<string, string> = {
    approuvee: i18n.rooms.statuses.approuvee,
    en_attente: i18n.rooms.statuses.en_attente,
    refusee: i18n.rooms.statuses.refusee,
    annulee: i18n.rooms.statuses.annulee,
  };
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('mes-reservations');

  // New reservation form
  const [formStep, setFormStep] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(fmtDateInput(new Date()));
  const [availability, setAvailability] = useState<{ reservations: { id: number; title: string; start_time: string; end_time: string; status: string }[]; available_slots: AvailableSlot[] } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);

  // Conflict modal
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictSuggestions, setConflictSuggestions] = useState<AvailableSlot[]>([]);

  // ---- Data loading ----

  const loadRooms = useCallback(async () => {
    try { setRooms(await apiFetchRooms()); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur'); }
  }, []);

  const loadMyReservations = useCallback(async () => {
    try { setMyReservations(await apiFetchMyReservations()); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur'); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadRooms(), loadMyReservations()]);
      setLoading(false);
    })();
  }, [loadRooms, loadMyReservations]);

  // ---- Availability ----

  const loadAvailability = useCallback(async () => {
    if (!selectedRoomId || !selectedDate) { setAvailability(null); return; }
    try {
      const data = await apiFetchAvailability(selectedRoomId, selectedDate);
      setAvailability(data);
    } catch { setAvailability(null); }
  }, [selectedRoomId, selectedDate]);

  useEffect(() => {
    if (activeTab === 'nouvelle') loadAvailability();
  }, [activeTab, loadAvailability]);

  // ---- Actions ----

  const handleCreateReservation = async () => {
    if (!selectedRoomId || !formTitle.trim()) { toast.error('Veuillez remplir tous les champs'); return; }
    setSubmitting(true);
    try {
      const startISO = `${selectedDate}T${formStartTime}:00`;
      const endISO = `${selectedDate}T${formEndTime}:00`;
      const result = await apiCreateReservation({
        room_id: selectedRoomId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        start_time: startISO,
        end_time: endISO,
      });
      if (result.conflict) {
        setConflictSuggestions(result.detail.suggestions || []);
        setShowConflictModal(true);
      } else {
        toast.success(result.data.status === 'en_attente' ? 'Réservation soumise (en attente de validation)' : 'Salle réservée avec succès');
        setFormStep(1); setFormTitle(''); setFormDescription('');
        setFormStartTime('09:00'); setFormEndTime('10:00');
        await loadMyReservations();
        setActiveTab('mes-reservations');
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur'); }
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Annuler cette réservation ?')) return;
    try { await apiCancel(id); toast.success('Réservation annulée'); await loadMyReservations(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur'); }
  };

  const pickSuggestion = (slot: AvailableSlot) => {
    const s = new Date(slot.start_time);
    const e = new Date(slot.end_time);
    setFormStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);
    setFormEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`);
    setShowConflictModal(false);
  };

  // ---- Time grid ----

  const renderTimeGrid = () => {
    if (!availability) return null;
    const slots: { hour: number; minute: number; label: string; busy: boolean; title?: string }[] = [];
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 30]) {
        const slotStart = new Date(`${selectedDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
        let busy = false;
        let title: string | undefined;
        for (const r of availability.reservations) {
          const rs = new Date(r.start_time);
          const re = new Date(r.end_time);
          if (!(slotEnd <= rs || slotStart >= re)) { busy = true; title = r.title; break; }
        }
        slots.push({ hour: h, minute: m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, busy, title });
      }
    }
    return (
      <div className="overflow-x-auto mt-3"><div className="min-w-[320px] grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {slots.map((s, i) => (
          <button
            key={i}
            type="button"
            disabled={s.busy}
            onClick={() => {
              setFormStartTime(s.label);
              const endH = s.minute === 30 ? s.hour + 1 : s.hour;
              const endM = s.minute === 30 ? 0 : 30;
              setFormEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
              setFormStep(2);
            }}
            className={`text-xs py-1.5 px-1 rounded text-center transition-colors ${
              s.busy
                ? 'bg-red-100 text-red-600 cursor-not-allowed'
                : 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
            }`}
            title={s.busy ? `Occupé : ${s.title}` : 'Disponible'}
          >
            {s.label}
          </button>
        ))}
      </div></div>
    );
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Header title={i18n.rooms.myTitle} hideAddButton />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        {([
          { key: 'mes-reservations' as const, label: i18n.rooms.myReservations },
          { key: 'nouvelle' as const, label: i18n.rooms.newReservation },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ MES RESERVATIONS ============ */}
      {activeTab === 'mes-reservations' && (
        <div className="space-y-3">
          {myReservations.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>{i18n.rooms.noReservations}</p>
              <button onClick={() => setActiveTab('nouvelle')} className="mt-3 text-sm text-primary-600 hover:underline">
                {i18n.rooms.makeReservation}
              </button>
            </div>
          ) : (
            myReservations.map(r => (
              <div key={r.id} className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">{r.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status] || ''}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{r.room_name}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(r.start_time)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtTime(r.start_time)} - {fmtTime(r.end_time)}</span>
                  </div>
                  {r.status === 'refusee' && r.refusal_reason && (
                    <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {i18n.rooms.refusalReasonLabel} : {r.refusal_reason}
                    </p>
                  )}
                </div>
                {(r.status === 'approuvee' || r.status === 'en_attente') && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="w-full sm:w-auto text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition-colors shrink-0 text-center"
                  >
                    {i18n.rooms.cancel}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ============ NOUVELLE RESERVATION ============ */}
      {activeTab === 'nouvelle' && (
        <div className="bg-white rounded-lg border p-6 max-w-2xl">
          {formStep === 1 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{i18n.rooms.chooseRoom}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.roomLabel}</label>
                  <CustomSelect
                    value={selectedRoomId !== null ? String(selectedRoomId) : ''}
                    onChange={(v) => setSelectedRoomId(v ? Number(v) : null)}
                    placeholder={i18n.rooms.selectRoom}
                    options={[
                      { value: '', label: i18n.rooms.selectRoom },
                      ...rooms.map(rm => ({
                        value: String(rm.id),
                        label: `${rm.name} (${rm.capacity} ${i18n.rooms.places})`,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.dateLabel}</label>
                  <CustomDatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    placeholder={i18n.rooms.dateLabel}
                  />
                </div>
              </div>

              {selectedRoomId && selectedDate && (
                <>
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Disponibilité — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h4>
                    <div className="flex gap-3 text-xs text-gray-500 mb-1">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> {i18n.rooms.available}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> {i18n.rooms.occupied}</span>
                    </div>
                    {renderTimeGrid()}
                  </div>
                  <button
                    onClick={() => setFormStep(2)}
                    className="mt-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {i18n.rooms.manualSlot} <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={() => setFormStep(1)} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
                &larr; {i18n.rooms.backToRoom}
              </button>
              <h3 className="text-lg font-semibold text-gray-900">{i18n.rooms.details}</h3>
              <p className="text-sm text-gray-500">
                {i18n.rooms.roomLabel} : <strong>{rooms.find(r => r.id === selectedRoomId)?.name}</strong> — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.startTime}</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.endTime}</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.titleLabel} *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder={i18n.rooms.titlePlaceholder}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.rooms.descriptionLabel}</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder={i18n.rooms.descriptionPlaceholder}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <button
                onClick={handleCreateReservation}
                disabled={submitting || !formTitle.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {i18n.rooms.reserve}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ MODAL CONFLIT ============ */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Ban className="h-5 w-5 text-red-500" />{i18n.rooms.conflictTitle}</h3>
              <button onClick={() => setShowConflictModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{i18n.rooms.conflictMessage}</p>
            {conflictSuggestions.length === 0 ? (
              <p className="text-sm text-gray-500">{i18n.rooms.noAlternatives}</p>
            ) : (
              <div className="space-y-2">
                {conflictSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-primary-400 hover:bg-primary-50 transition-colors text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary-500" />
                      {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                    </span>
                    <span className="text-primary-600 font-medium text-xs">{i18n.rooms.chooseSlot}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
