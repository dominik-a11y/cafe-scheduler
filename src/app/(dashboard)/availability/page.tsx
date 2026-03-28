'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, ClipboardCheck, Pencil } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';
import type { ShiftDefinition } from '@/lib/types';

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
  shift_definition_id: string | null;
}

type AddMode = 'idle' | 'choosing';

export default function AvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([]);
  const [addModeDay, setAddModeDay] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const supabase = createClient();
  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [slotsRes, shiftsRes] = await Promise.all([
      supabase
        .from('availability')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date'),
      supabase
        .from('shift_definitions')
        .select('*')
        .order('start_time'),
    ]);

    if (slotsRes.data) setSlots(slotsRes.data as AvailabilitySlot[]);
    if (shiftsRes.data) setShiftDefs(shiftsRes.data as ShiftDefinition[]);
    setLoading(false);
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSlotManual = async (day: Date) => {
    if (!userId) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    await supabase.from('availability').insert([{
      user_id: userId,
      date: dateStr,
      start_time: '08:00',
      end_time: '16:00',
      shift_definition_id: null,
    }]);
    setAddModeDay(null);
    fetchData();
  };

  const addSlotFromShift = async (day: Date, shift: ShiftDefinition) => {
    if (!userId) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    await supabase.from('availability').insert([{
      user_id: userId,
      date: dateStr,
      start_time: shift.start_time,
      end_time: shift.end_time,
      shift_definition_id: shift.id,
    }]);
    setAddModeDay(null);
    fetchData();
  };

  const updateSlot = async (id: string, field: string, value: string) => {
    // When editing, reset status to pending so admin re-reviews
    await supabase.from('availability').update({
      [field]: value,
      shift_definition_id: null,
      status: 'pending',
    }).eq('id', id);
    fetchData();
  };

  const deleteSlot = async (id: string) => {
    await supabase.from('availability').delete().eq('id', id);
    setEditingSlotId(null);
    fetchData();
  };

  const slotsForDay = (day: Date) =>
    slots.filter((s) => isSameDay(new Date(s.date + 'T00:00:00'), day));

  const isToday = (day: Date) => isSameDay(day, new Date());

  const statusColor = (s: string) => {
    if (s === 'approved') return 'border-green-300 bg-green-50';
    if (s === 'rejected') return 'border-red-300 bg-red-50';
    return 'border-amber-300 bg-amber-50';
  };

  const statusLabel = (s: string) => {
    if (s === 'approved') return 'Zatwierdzony';
    if (s === 'rejected') return 'Odrzucony';
    return 'Oczekujący';
  };

  const statusDot = (s: string) => {
    if (s === 'approved') return 'bg-green-500';
    if (s === 'rejected') return 'bg-red-500';
    return 'bg-amber-500';
  };

  const getShiftName = (slot: AvailabilitySlot) => {
    if (!slot.shift_definition_id) return null;
    const shift = shiftDefs.find((s) => s.id === slot.shift_definition_id);
    return shift?.name || null;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-amber-600" />
            Moja dyspozycyjność
          </h1>
          <p className="text-sm text-gray-500 mt-1">Zaznacz kiedy jesteś dostępny/a w danym tygodniu</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate((d) => addDays(d, -7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">Dziś</button>
          <button onClick={() => setCurrentDate((d) => addDays(d, 7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-500">
        {formatDatePL(weekStart, 'd MMMM')} – {formatDatePL(weekEnd, 'd MMMM yyyy')}
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Wczytywanie...</div>
      ) : (
        <div className="space-y-3">
          {weekDays.map((day, i) => {
            const daySlots = slotsForDay(day);
            const today = isToday(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const showingAddOptions = addModeDay === dateStr;

            return (
              <div key={i} className={`rounded-lg border overflow-hidden ${today ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between ${today ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <div>
                    <span className={`text-sm font-semibold ${today ? 'text-amber-800' : 'text-gray-900'}`}>{DAY_NAMES_PL[i]}</span>
                    <span className="text-xs text-gray-500 ml-2">{format(day, 'dd.MM')}</span>
                  </div>
                  <button
                    onClick={() => setAddModeDay(showingAddOptions ? null : dateStr)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                      showingAddOptions
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Plus size={14} /> {showingAddOptions ? 'Anuluj' : 'Dodaj'}
                  </button>
                </div>

                {/* Add options panel */}
                {showingAddOptions && (
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs text-blue-700 font-medium mb-2">Wybierz sposób dodania:</p>
                    <div className="flex flex-wrap gap-2">
                      {shiftDefs.map((shift) => (
                        <button
                          key={shift.id}
                          onClick={() => addSlotFromShift(day, shift)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition hover:shadow-sm"
                          style={{
                            backgroundColor: shift.color + '15',
                            borderColor: shift.color + '50',
                            color: shift.color,
                          }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }} />
                          {shift.name} ({shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)})
                        </button>
                      ))}
                      <button
                        onClick={() => addSlotManual(day)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
                      >
                        Ręcznie (własne godziny)
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white">
                  {daySlots.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">Brak zgłoszonej dyspozycyjności</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {daySlots.map((slot) => {
                        const shiftName = getShiftName(slot);
                        const isEditing = editingSlotId === slot.id;
                        const isApprovedOrRejected = slot.status !== 'pending';

                        return (
                          <div key={slot.id} className={`px-4 py-2.5 ${statusColor(slot.status)} border-l-4`}>
                            {/* Mobile-friendly layout */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {shiftName && (
                                  <span className="text-xs font-medium text-gray-700 bg-white/70 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                                    {shiftName}
                                  </span>
                                )}
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <input type="time" value={slot.start_time}
                                      onChange={(e) => updateSlot(slot.id, 'start_time', e.target.value)}
                                      className="px-1.5 py-1 border border-gray-300 rounded text-sm w-24" />
                                    <span className="text-gray-400">–</span>
                                    <input type="time" value={slot.end_time}
                                      onChange={(e) => updateSlot(slot.id, 'end_time', e.target.value)}
                                      className="px-1.5 py-1 border border-gray-300 rounded text-sm w-24" />
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-700">
                                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`w-2 h-2 rounded-full ${statusDot(slot.status)}`} title={statusLabel(slot.status)} />
                                <span className="text-xs text-gray-500 hidden sm:inline">{statusLabel(slot.status)}</span>

                                {!isEditing ? (
                                  <button
                                    onClick={() => setEditingSlotId(slot.id)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition"
                                    title="Edytuj"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setEditingSlotId(null)}
                                    className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                                  >
                                    OK
                                  </button>
                                )}

                                <button onClick={() => deleteSlot(slot.id)} className="p-1 text-gray-400 hover:text-red-600 transition" title="Usuń">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Info when editing approved/rejected entry */}
                            {isEditing && isApprovedOrRejected && (
                              <p className="text-xs text-amber-600 mt-1.5">
                                Po edycji status zmieni się na &quot;Oczekujący&quot; — admin będzie musiał ponownie zatwierdzić.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
