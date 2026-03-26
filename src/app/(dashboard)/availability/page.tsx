'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function AvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();
  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .order('date');

    if (data) setSlots(data as AvailabilitySlot[]);
    setLoading(false);
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSlot = async (day: Date) => {
    if (!userId) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    await supabase.from('availability').insert([{
      user_id: userId,
      date: dateStr,
      start_time: '08:00',
      end_time: '16:00',
    }]);
    fetchData();
  };

  const updateSlot = async (id: string, field: string, value: string) => {
    await supabase.from('availability').update({ [field]: value }).eq('id', id);
    fetchData();
  };

  const deleteSlot = async (id: string) => {
    await supabase.from('availability').delete().eq('id', id);
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
            return (
              <div key={i} className={`rounded-lg border overflow-hidden ${today ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between ${today ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <div>
                    <span className={`text-sm font-semibold ${today ? 'text-amber-800' : 'text-gray-900'}`}>{DAY_NAMES_PL[i]}</span>
                    <span className="text-xs text-gray-500 ml-2">{format(day, 'dd.MM')}</span>
                  </div>
                  <button onClick={() => addSlot(day)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    <Plus size={14} /> Dodaj
                  </button>
                </div>
                <div className="bg-white">
                  {daySlots.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">Brak zgłoszonej dyspozycyjności</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className={`px-4 py-2.5 flex items-center gap-3 ${statusColor(slot.status)} border-l-4`}>
                          <input type="time" value={slot.start_time} disabled={slot.status !== 'pending'}
                            onChange={(e) => updateSlot(slot.id, 'start_time', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-500" />
                          <span className="text-gray-400">–</span>
                          <input type="time" value={slot.end_time} disabled={slot.status !== 'pending'}
                            onChange={(e) => updateSlot(slot.id, 'end_time', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-500" />
                          <span className="text-xs text-gray-500 ml-auto">{statusLabel(slot.status)}</span>
                          {slot.status === 'pending' && (
                            <button onClick={() => deleteSlot(slot.id)} className="p-1 text-gray-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
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
