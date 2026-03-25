'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';
import type { Profile, ShiftDefinition, ScheduleEntry } from '@/lib/types';

interface ScheduleEntryWithRelations extends ScheduleEntry {
  profiles: Pick<Profile, 'id' | 'full_name' | 'email'>;
  shift_definitions: Pick<ShiftDefinition, 'id' | 'name' | 'start_time' | 'end_time' | 'color'>;
}

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<ScheduleEntryWithRelations[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const [entriesRes, employeesRes] = await Promise.all([
        supabase
          .from('schedule_entries')
          .select(`
            *,
            profiles:user_id (id, full_name, email),
            shift_definitions:shift_definition_id (id, name, start_time, end_time, color)
          `)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date'),
        supabase
          .from('profiles')
          .select('*')
          .order('full_name'),
      ]);

      if (entriesRes.data) {
        setEntries(entriesRes.data as unknown as ScheduleEntryWithRelations[]);
      }
      if (employeesRes.data) {
        setEmployees(employeesRes.data as Profile[]);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToPrevWeek = () => setCurrentDate((d) => addDays(d, -7));
  const goToNextWeek = () => setCurrentDate((d) => addDays(d, 7));
  const goToToday = () => setCurrentDate(new Date());

  function getEntriesForCell(employeeId: string, day: Date) {
    return entries.filter(
      (e) =>
        e.profiles?.id === employeeId &&
        isSameDay(new Date(e.date + 'T00:00:00'), day)
    );
  }

  function formatTime(time: string) {
    return time.slice(0, 5);
  }

  const isToday = (day: Date) => isSameDay(day, new Date());

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-amber-600" />
            Harmonogram
          </h1>
          <p className="text-gray-600 mt-1">
            Tygodniowy grafik zmian pracowników
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Poprzedni tydzień"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm font-medium"
          >
            Dziś
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Następny tydzień"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week range label */}
      <div className="mb-4 text-sm text-gray-500">
        {formatDatePL(weekStart, 'd MMMM')} – {formatDatePL(weekEnd, 'd MMMM yyyy')}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Wczytywanie harmonogramu...</div>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700 mb-1">Brak pracowników</p>
          <p>Dodaj pracowników, aby zobaczyć harmonogram.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-sm font-medium text-gray-600 p-3 border-b border-r border-gray-200 w-40 sticky left-0 bg-gray-50 z-10">
                  Pracownik
                </th>
                {weekDays.map((day, i) => (
                  <th
                    key={i}
                    className={`text-center text-sm font-medium p-3 border-b border-r border-gray-200 last:border-r-0 ${
                      isToday(day)
                        ? 'bg-amber-50 text-amber-800'
                        : 'text-gray-600'
                    }`}
                  >
                    <div>{DAY_NAMES_PL[i]}</div>
                    <div className={`text-xs mt-0.5 ${isToday(day) ? 'font-bold' : 'font-normal'}`}>
                      {format(day, 'dd.MM')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="text-sm text-gray-900 p-3 border-b border-r border-gray-200 font-medium sticky left-0 bg-white z-10">
                    <div className="truncate max-w-[150px]">
                      {emp.full_name || emp.email}
                    </div>
                    <div className="text-xs text-gray-400 font-normal">
                      {emp.role === 'admin' ? 'Admin' : 'Pracownik'}
                    </div>
                  </td>
                  {weekDays.map((day, dayIdx) => {
                    const cellEntries = getEntriesForCell(emp.id, day);
                    return (
                      <td
                        key={dayIdx}
                        className={`p-2 border-b border-r border-gray-200 last:border-r-0 align-top min-w-[100px] ${
                          isToday(day) ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          {cellEntries.map((entry) => {
                            const shift = entry.shift_definitions;
                            const startTime = entry.custom_start_time || shift?.start_time;
                            const endTime = entry.custom_end_time || shift?.end_time;
                            const color = shift?.color || '#3b82f6';

                            return (
                              <div
                                key={entry.id}
                                className="rounded-md px-2 py-1.5 text-xs leading-tight"
                                style={{
                                  backgroundColor: color + '18',
                                  borderLeft: `3px solid ${color}`,
                                }}
                                title={entry.notes || undefined}
                              >
                                <div className="font-medium" style={{ color }}>
                                  {shift?.name || 'Zmiana'}
                                </div>
                                {startTime && endTime && (
                                  <div className="text-gray-500 mt-0.5">
                                    {formatTime(startTime)} – {formatTime(endTime)}
                                  </div>
                                )}
                                {entry.notes && (
                                  <div className="text-gray-400 mt-0.5 truncate max-w-[80px]">
                                    {entry.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
