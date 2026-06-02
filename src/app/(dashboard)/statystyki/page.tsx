'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, BarChart3, Clock, CalendarDays, FileDown } from 'lucide-react';
import { getWeekRange, getMonthRange, formatDatePL, calculateHours, MONTH_NAMES_PL } from '@/lib/utils';
import { generateHoursRegistryPdf } from '@/lib/pdf';
import { useOrg } from '@/lib/OrgContext';

type ViewMode = 'week' | 'month';

interface EntryRow {
  id: string;
  date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  shift_definitions: { id: string; name: string; start_time: string; end_time: string; color: string } | null;
}

function entryHours(e: EntryRow): number {
  const start = e.custom_start_time || e.shift_definitions?.start_time || '00:00';
  const end = e.custom_end_time || e.shift_definitions?.end_time || '00:00';
  return calculateHours(start, end);
}

export default function MyStatsPage() {
  const { userId } = useOrg();
  const supabase = createClient();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();
      if (data) setEmployeeName(data.full_name || data.email);
    })();
  }, [userId]);

  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const { start: monthStart, end: monthEnd } = getMonthRange(currentYear, currentMonth);

  const rangeStart = viewMode === 'week' ? weekStart : monthStart;
  const rangeEnd = viewMode === 'week' ? weekEnd : monthEnd;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(rangeStart, 'yyyy-MM-dd');
      const endStr = format(rangeEnd, 'yyyy-MM-dd');

      const { data } = await supabase
        .from('schedule_entries')
        .select(`
          id, date, custom_start_time, custom_end_time,
          shift_definitions:shift_definition_id (id, name, start_time, end_time, color)
        `)
        .eq('user_id', userId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date');

      setEntries((data || []) as unknown as EntryRow[]);
    } catch (e) {
      console.error('Error fetching stats:', e);
    } finally {
      setLoading(false);
    }
  }, [rangeStart.getTime(), rangeEnd.getTime(), userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    let totalHours = 0;
    const shifts: Record<string, { count: number; hours: number; color: string }> = {};
    for (const e of entries) {
      const hours = entryHours(e);
      totalHours += hours;
      const name = e.shift_definitions?.name || 'Inna';
      const color = e.shift_definitions?.color || '#6b7280';
      if (!shifts[name]) shifts[name] = { count: 0, hours: 0, color };
      shifts[name].count += 1;
      shifts[name].hours += hours;
    }
    return { totalHours, shiftCount: entries.length, shifts };
  }, [entries]);

  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      const m = viewMode === 'month' ? currentMonth : currentDate.getMonth();
      const y = viewMode === 'month' ? currentYear : currentDate.getFullYear();
      const { start: ms, end: me } = getMonthRange(y, m);

      const { data } = await supabase
        .from('schedule_entries')
        .select(`
          id, date, custom_start_time, custom_end_time,
          shift_definitions:shift_definition_id (id, name, start_time, end_time, color)
        `)
        .eq('user_id', userId)
        .gte('date', format(ms, 'yyyy-MM-dd'))
        .lte('date', format(me, 'yyyy-MM-dd'))
        .order('date');

      await generateHoursRegistryPdf(
        employeeName || 'Pracownik',
        m,
        y,
        (data || []) as unknown as EntryRow[],
      );
    } catch (e) {
      console.error('PDF generation error:', e);
    } finally {
      setPdfLoading(false);
    }
  };

  const goPrev = () => {
    if (viewMode === 'week') {
      setCurrentDate((d) => addDays(d, -7));
    } else {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
      else setCurrentMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (viewMode === 'week') {
      setCurrentDate((d) => addDays(d, 7));
    } else {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
      else setCurrentMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setCurrentMonth(new Date().getMonth());
    setCurrentYear(new Date().getFullYear());
  };

  const rangeLabel = viewMode === 'week'
    ? `${formatDatePL(weekStart, 'd MMMM')} – ${formatDatePL(weekEnd, 'd MMMM yyyy')}`
    : `${MONTH_NAMES_PL[currentMonth]} ${currentYear}`;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-amber-600" />
            Moje statystyki
          </h1>
          <p className="text-sm text-gray-500 mt-1">Twoje godziny pracy i zmiany w wybranym okresie</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm self-start">
          <button onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 transition ${viewMode === 'week' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
            Tydzień
          </button>
          <button onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 transition ${viewMode === 'month' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
            Miesiąc
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={goPrev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronLeft size={18} />
        </button>
        <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">Dziś</button>
        <button onClick={goNext} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronRight size={18} />
        </button>
        <span className="text-sm text-gray-500 ml-2">{rangeLabel}</span>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Wczytywanie danych...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700 mb-1">Brak zmian</p>
          <p className="text-gray-500">W wybranym okresie nie masz zaplanowanych zmian.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><CalendarDays size={12} /> Zmiany</div>
              <div className="text-2xl font-semibold text-gray-900">{stats.shiftCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={12} /> Godziny</div>
              <div className="text-2xl font-semibold text-gray-900">{stats.totalHours.toFixed(1)} h</div>
            </div>
          </div>

          {/* Shift type breakdown */}
          {Object.keys(stats.shifts).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Podział wg typu zmiany</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.shifts).map(([name, data]) => (
                  <div key={name} className="rounded-lg border border-gray-200 px-4 py-3 bg-white flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: data.color }} />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-500">{data.count} zmian &middot; {data.hours.toFixed(1)} h</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed shift list */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Szczegóły zmian</h2>
            <button
              onClick={handlePdfExport}
              disabled={pdfLoading}
              title="Pobierz rejestr godzin (PDF) za miesiąc"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:text-amber-700 transition disabled:opacity-50"
            >
              <FileDown size={16} className={pdfLoading ? 'animate-pulse' : ''} />
              Rejestr godzin (PDF)
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 bg-white">
            {entries.map((e) => {
              const start = (e.custom_start_time || e.shift_definitions?.start_time || '00:00').slice(0, 5);
              const end = (e.custom_end_time || e.shift_definitions?.end_time || '00:00').slice(0, 5);
              const color = e.shift_definitions?.color || '#6b7280';
              const name = e.shift_definitions?.name || 'Inna';
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-900 capitalize">{formatDatePL(new Date(e.date + 'T00:00:00'), 'EEEE, d MMMM')}</div>
                    <div className="text-xs text-gray-500">{name}</div>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-nowrap">{start} – {end}</div>
                  <div className="text-sm font-semibold text-gray-900 w-14 text-right">{entryHours(e).toFixed(1)} h</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
