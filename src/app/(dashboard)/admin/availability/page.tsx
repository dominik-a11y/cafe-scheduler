'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X, RefreshCw } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface AvailabilityEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
  shift_definition_id: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

export default function AdminAvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
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

  const handleAction = async (entry: AvailabilityEntry, status: 'approved' | 'rejected') => {
    setActionLoading(entry.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update availability status
      await supabase.from('availability').update({ status, reviewed_by: user.id }).eq('id', entry.id);

      // If approved, also create a schedule entry so it appears on the schedule
      if (status === 'approved') {
        const scheduleEntry: Record<string, unknown> = {
          user_id: entry.user_id,
          date: entry.date,
        };

        if (entry.shift_definition_id) {
          scheduleEntry.shift_definition_id = entry.shift_definition_id;
          scheduleEntry.custom_start_time = null;
          scheduleEntry.custom_end_time = null;
        } else {
          scheduleEntry.shift_definition_id = null;
          scheduleEntry.custom_start_time = entry.start_time;
          scheduleEntry.custom_end_time = entry.end_time;
        }

        await supabase.from('schedule_entries').insert([scheduleEntry]);
      }

      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      // 1. Get all approved availability for this week
      const { data: approved, error: fetchError } = await supabase
        .from('availability')
        .select('*')
        .eq('status', 'approved')
        .gte('date', startStr)
        .lte('date', endStr);

      if (fetchError) {
        setSyncMessage('B\u0142\u0105d pobierania dyspozycyjno\u015bci: ' + fetchError.message);
        return;
      }

      // 2. Delete existing schedule entries for this week
      const { error: deleteError } = await supabase
        .from('schedule_entries')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr);

      if (deleteError) {
        setSyncMessage('B\u0142\u0105d usuwania starych wpis\u00f3w: ' + deleteError.message);
        return;
      }

      // 3. Re-create schedule entries from approved availability
      if (approved && approved.length > 0) {
        const newEntries = approved.map((a: AvailabilityEntry) => {
          const entry: Record<string, unknown> = {
            user_id: a.user_id,
            date: a.date,
          };

          if (a.shift_definition_id) {
            entry.shift_definition_id = a.shift_definition_id;
            entry.custom_start_time = null;
            entry.custom_end_time = null;
          } else {
            entry.shift_definition_id = null;
            entry.custom_start_time = a.start_time;
            entry.custom_end_time = a.end_time;
          }

          return entry;
        });

        const { error: insertError } = await supabase
          .from('schedule_entries')
          .insert(newEntries);

        if (insertError) {
          setSyncMessage('B\u0142\u0105d tworzenia wpis\u00f3w: ' + insertError.message);
          return;
        }

        setSyncMessage(`Zsynchronizowano: ${newEntries.length} wpis\u00f3w w harmonogramie.`);
      } else {
        setSyncMessage('Brak zatwierdzonych dyspozycyjno\u015bci w tym tygodniu.');
      }
    } catch (err: unknown) {
      setSyncMessage('B\u0142\u0105d: ' + String(err));
    } finally {
      setSyncLoading(false);
    }
  };

  const goToPrevWeek = () => { setCurrentDate((d) => addDays(d, -7)); setSyncMessage(null); };
  const goToNextWeek = () => { setCurrentDate((d) => addDays(d, 7)); setSyncMessage(null); };

  const statusBadge = (s: string) => {
    if (s === 'approved') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Zatwierdzony</span>;
    if (s === 'rejected') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Odrzucony</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Oczekuj&#261;cy</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light">Dyspozycyjno&#347;&#263; pracownik&oacute;w</h1>
          <p className="text-sm text-gray-500 mt-1">Przegl&#261;daj i zatwierdzaj zg&#322;oszon&#261; dyspozycyjno&#347;&#263;</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToPrevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            {formatDatePL(weekStart, 'd MMM')} &ndash; {formatDatePL(weekEnd, 'd MMM')}
          </span>
          <button onClick={goToNextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Oczekuj&#261;ce</button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Wszystkie</button>

        <div className="sm:ml-auto">
          <button
            onClick={handleSync}
            disabled={syncLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
            Synchronizuj harmonogram
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${syncMessage.startsWith('B\u0142\u0105d') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncMessage}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-12">Wczytywanie...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium text-gray-700 mb-1">{filter === 'pending' ? 'Brak oczekuj\u0105cych zg\u0142osze\u0144' : 'Brak zg\u0142osze\u0144 w tym tygodniu'}</p>
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
                  {e.start_time.slice(0,5)} &ndash; {e.end_time.slice(0,5)}
                </div>
                {statusBadge(e.status)}
              </div>
              {e.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(e, 'approved')} disabled={actionLoading === e.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                    <Check size={14} /> Zatwierd&#378;
                  </button>
                  <button onClick={() => handleAction(e, 'rejected')} disabled={actionLoading === e.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                    <X size={14} /> Odrzu&#263;
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
