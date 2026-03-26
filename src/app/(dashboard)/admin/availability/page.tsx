'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface AvailabilityEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

export default function AdminAvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const supabase = createClient();
  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    let query = supabase
      .from('availability')
      .select('*, profiles:user_id (id, full_name, email)')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date');

    if (filter === 'pending') query = query.eq('status', 'pending');

    const { data } = await query;
    if (data) setEntries(data as unknown as AvailabilityEntry[]);
    setLoading(false);
  }, [weekStart.getTime(), weekEnd.getTime(), filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('availability').update({ status, reviewed_by: user?.id }).eq('id', id);
    fetchData();
  };

  const goToPrevWeek = () => setCurrentDate((d) => addDays(d, -7));
  const goToNextWeek = () => setCurrentDate((d) => addDays(d, 7));

  const statusBadge = (s: string) => {
    if (s === 'approved') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Zatwierdzony</span>;
    if (s === 'rejected') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Odrzucony</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Oczekujący</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light">Dyspozycyjność pracowników</h1>
          <p className="text-sm text-gray-500 mt-1">Przeglądaj i zatwierdzaj zgłoszoną dyspozycyjność</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToPrevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            {formatDatePL(weekStart, 'd MMM')} – {formatDatePL(weekEnd, 'd MMM')}
          </span>
          <button onClick={goToNextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Oczekujące</button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Wszystkie</button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Wczytywanie...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium text-gray-700 mb-1">{filter === 'pending' ? 'Brak oczekujących zgłoszeń' : 'Brak zgłoszeń w tym tygodniu'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-200 rounded-lg gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.profiles?.full_name || e.profiles?.email || 'Pracownik'}</p>
                  <p className="text-xs text-gray-500">
                    {DAY_NAMES_PL[new Date(e.date + 'T00:00:00').getDay() === 0 ? 6 : new Date(e.date + 'T00:00:00').getDay() - 1]}, {format(new Date(e.date + 'T00:00:00'), 'dd.MM')}
                  </p>
                </div>
                <div className="text-sm text-gray-700">
                  {e.start_time.slice(0,5)} – {e.end_time.slice(0,5)}
                </div>
                {statusBadge(e.status)}
              </div>
              {e.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(e.id, 'approved')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">
                    <Check size={14} /> Zatwierdź
                  </button>
                  <button onClick={() => handleAction(e.id, 'rejected')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition">
                    <X size={14} /> Odrzuć
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
