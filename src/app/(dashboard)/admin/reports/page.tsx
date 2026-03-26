'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, BarChart3, Users, Clock, CalendarDays } from 'lucide-react';
import { getWeekRange, getMonthRange, DAY_NAMES_PL, formatDatePL, calculateHours } from '@/lib/utils';
import type { Profile, ShiftDefinition } from '@/lib/types';

type ViewMode = 'week' | 'month';

interface ScheduleEntryRow {
  id: string;
  user_id: string;
  date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  profiles: Pick<Profile, 'id' | 'full_name' | 'email'>;
  shift_definitions: Pick<ShiftDefinition, 'id' | 'name' | 'start_time' | 'end_time' | 'color'>;
}

interface EmployeeStats {
  id: string;
  name: string;
  email: string;
  totalHours: number;
  shiftCount: number;
  shifts: Record<string, { count: number; hours: number; color: string }>;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<ScheduleEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([]);

  const supabase = createClient();

  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const { start: monthStart, end: monthEnd } = getMonthRange(currentYear, currentMonth);

  const rangeStart = viewMode === 'week' ? weekStart : monthStart;
  const rangeEnd = viewMode === 'week' ? weekEnd : monthEnd;

  const MONTH_NAMES_PL = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(rangeStart, 'yyyy-MM-dd');
      const endStr = format(rangeEnd, 'yyyy-MM-dd');

      const [entriesRes, shiftsRes] = await Promise.all([
        supabase
          .from('schedule_entries')
          .select(`
            id, user_id, date, custom_start_time, custom_end_time,
            profiles:user_id (id, full_name, email),
            shift_definitions:shift_definition_id (id, name, start_time, end_time, color)
          `)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date'),
        supabase.from('shift_definitions').select('*').order('name'),
      ]);

      if (entriesRes.data) setEntries(entriesRes.data as unknown as ScheduleEntryRow[]);
      if (shiftsRes.data) setShiftDefs(shiftsRes.data as ShiftDefinition[]);
    } catch (e) {
      console.error('Error fetching report data:', e);
    } finally {
      setLoading(false);
    }
  }, [rangeStart.getTime(), rangeEnd.getTime()]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build per-employee stats
  const employeeStats: EmployeeStats[] = (() => {
    const map = new Map<string, EmployeeStats>();
    for (const entry of entries) {
      const profile = entry.profiles;
      if (!profile) continue;
      if (!map.has(profile.id)) {
        map.set(profile.id, {
          id: profile.id,
          name: profile.full_name || profile.email,
          email: profile.email,
          totalHours: 0,
          shiftCount: 0,
          shifts: {},
        });
      }
      const stat = map.get(profile.id)!;
      const shift = entry.shift_definitions;
      const startTime = entry.custom_start_time || shift?.start_time || '00:00';
      const endTime = entry.custom_end_time || shift?.end_time || '00:00';
      const hours = calculateHours(startTime, endTime);

      stat.totalHours += hours;
      stat.shiftCount += 1;

      const shiftName = shift?.name || 'Inna';
      const shiftColor = shift?.color || '#6b7280';
      if (!stat.shifts[shiftName]) {
        stat.shifts[shiftName] = { count: 0, hours: 0, color: shiftColor };
      }
      stat.shifts[shiftName].count += 1;
      stat.shifts[shiftName].hours += hours;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  })();

  const totalHoursAll = employeeStats.reduce((s, e) => s + e.totalHours, 0);
  const totalShiftsAll = employeeStats.reduce((s, e) => s + e.shiftCount, 0);

  // Shift breakdown totals
  const shiftTotals: Record<string, { count: number; hours: number; color: string }> = {};
  for (const stat of employeeStats) {
    for (const [name, data] of Object.entries(stat.shifts)) {
      if (!shiftTotals[name]) shiftTotals[name] = { count: 0, hours: 0, color: data.color };
      shiftTotals[name].count += data.count;
      shiftTotals[name].hours += data.hours;
    }
  }

  // Navigation
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
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-amber-600" />
            Raporty
          </h1>
          <p className="text-sm text-gray-500 mt-1">Podsumowanie godzin pracy i statystyki zmian</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
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
          <p className="text-lg font-medium text-gray-700 mb-1">Brak danych</p>
          <p className="text-gray-500">W wybranym okresie nie ma zaplanowanych zmian.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users size={12} /> Pracownicy</div>
              <div className="text-2xl font-semibold text-gray-900">{employeeStats.length}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><CalendarDays size={12} /> Zmiany</div>
              <div className="text-2xl font-semibold text-gray-900">{totalShiftsAll}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={12} /> Godziny</div>
              <div className="text-2xl font-semibold text-gray-900">{totalHoursAll.toFixed(1)} h</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs text-gray-500 mb-1">Śr. na pracownika</div>
              <div className="text-2xl font-semibold text-gray-900">
                {employeeStats.length > 0 ? (totalHoursAll / employeeStats.length).toFixed(1) : '0'} h
              </div>
            </div>
          </div>

          {/* Shift type breakdown */}
          {Object.keys(shiftTotals).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Podział wg typu zmiany</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(shiftTotals).map(([name, data]) => (
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

          {/* Per-employee table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-600 p-3 border-b border-gray-200">Pracownik</th>
                  <th className="text-center text-xs font-semibold text-gray-600 p-3 border-b border-gray-200">Zmian</th>
                  <th className="text-center text-xs font-semibold text-gray-600 p-3 border-b border-gray-200">Godziny</th>
                  <th className="text-left text-xs font-semibold text-gray-600 p-3 border-b border-gray-200 hidden sm:table-cell">Rozkład zmian</th>
                </tr>
              </thead>
              <tbody>
                {employeeStats.map((stat) => (
                  <tr key={stat.id} className="hover:bg-gray-50/50">
                    <td className="p-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{stat.name}</div>
                      <div className="text-xs text-gray-400">{stat.email}</div>
                    </td>
                    <td className="p-3 border-b border-gray-100 text-center">
                      <span className="text-sm font-semibold text-gray-900">{stat.shiftCount}</span>
                    </td>
                    <td className="p-3 border-b border-gray-100 text-center">
                      <span className="text-sm font-semibold text-gray-900">{stat.totalHours.toFixed(1)} h</span>
                    </td>
                    <td className="p-3 border-b border-gray-100 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(stat.shifts).map(([name, data]) => (
                          <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                            style={{ backgroundColor: data.color + '20', color: data.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.color }} />
                            {name}: {data.count}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-3 text-sm text-gray-700">Razem</td>
                  <td className="p-3 text-center text-sm text-gray-700">{totalShiftsAll}</td>
                  <td className="p-3 text-center text-sm text-gray-700">{totalHoursAll.toFixed(1)} h</td>
                  <td className="p-3 hidden sm:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
