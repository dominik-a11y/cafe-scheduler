'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, getDaysInMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, BarChart3, Users, Clock, CalendarDays, FileDown, DollarSign } from 'lucide-react';
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

const MONTH_NAMES_PL = [
  'Stycze\u0144', 'Luty', 'Marzec', 'Kwiecie\u0144', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpie\u0144', 'Wrzesie\u0144', 'Pa\u017adziernik', 'Listopad', 'Grudzie\u0144',
];

const MONTH_NAMES_PL_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'wrze\u015bnia', 'pa\u017adziernika', 'listopada', 'grudnia',
];

function loadRates(): Record<string, number> {
  try {
    const raw = localStorage.getItem('cafe_hourly_rates');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveRates(rates: Record<string, number>) {
  localStorage.setItem('cafe_hourly_rates', JSON.stringify(rates));
}

async function generatePdf(
  employeeName: string,
  month: number,
  year: number,
  entries: ScheduleEntryRow[],
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Rejestr godzin realizacji zlecenia', pageWidth / 2, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rozliczenie liczby godzin wykonywania uslug do umowy zlecenia nr ....................', 14, 32);
  doc.text(`w ${MONTH_NAMES_PL[month].toLowerCase()} ${year}`, 14, 39);
  doc.text(`Zleceniobiorca: ${employeeName}`, 14, 46);

  // Build table data - one row per day of month
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const tableBody: (string | number)[][] = [];
  let totalHours = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEntries = entries.filter((e) => e.date === dateStr);

    if (dayEntries.length === 0) {
      tableBody.push([`${day}.`, '', '', '']);
    } else {
      // Combine all entries for this day
      let dayHours = 0;
      const timeRanges: string[] = [];

      for (const entry of dayEntries) {
        const shift = entry.shift_definitions;
        const start = entry.custom_start_time || shift?.start_time || '00:00';
        const end = entry.custom_end_time || shift?.end_time || '00:00';
        const hours = calculateHours(start, end);
        dayHours += hours;
        timeRanges.push(`${start.slice(0, 5)}-${end.slice(0, 5)}`);
      }

      totalHours += dayHours;
      const hoursStr = dayHours % 1 === 0 ? String(dayHours) : dayHours.toFixed(1);
      tableBody.push([`${day}.`, `${hoursStr} h  (${timeRanges.join(', ')})`, '', '']);
    }
  }

  // Total row
  const totalStr = totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1);
  tableBody.push([{ content: 'Lacznie', styles: { fontStyle: 'bold' } } as any, { content: `${totalStr} h`, styles: { fontStyle: 'bold' } } as any, '', '']);

  // Draw table
  (doc as any).autoTable({
    startY: 52,
    head: [['Dzien\nmiesiaca', 'Liczba godzin\nrealizacji zlecenia', 'Podpis\nzleceniobiorcy', 'Podpis\nzleceniodawcy']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 52 },
      2: { cellWidth: 55 },
      3: { cellWidth: 55 },
    },
    styles: {
      lineColor: [180, 180, 180],
      lineWidth: 0.3,
    },
    margin: { left: 14, right: 14 },
  });

  // Download
  const fileName = `rejestr_godzin_${employeeName.replace(/\s+/g, '_')}_${MONTH_NAMES_PL[month].toLowerCase()}_${year}.pdf`;
  doc.save(fileName);
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<ScheduleEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    setRates(loadRates());
  }, []);

  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const { start: monthStart, end: monthEnd } = getMonthRange(currentYear, currentMonth);

  const rangeStart = viewMode === 'week' ? weekStart : monthStart;
  const rangeEnd = viewMode === 'week' ? weekEnd : monthEnd;

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
  const totalSalaryAll = employeeStats.reduce((s, e) => s + e.totalHours * (rates[e.id] || 0), 0);

  // Shift breakdown totals
  const shiftTotals: Record<string, { count: number; hours: number; color: string }> = {};
  for (const stat of employeeStats) {
    for (const [name, data] of Object.entries(stat.shifts)) {
      if (!shiftTotals[name]) shiftTotals[name] = { count: 0, hours: 0, color: data.color };
      shiftTotals[name].count += data.count;
      shiftTotals[name].hours += data.hours;
    }
  }

  const updateRate = (employeeId: string, value: string) => {
    const num = parseFloat(value);
    const newRates = { ...rates, [employeeId]: isNaN(num) ? 0 : num };
    setRates(newRates);
    saveRates(newRates);
  };

  const handlePdfExport = async (stat: EmployeeStats) => {
    setPdfLoading(stat.id);
    try {
      // For PDF we always need full month data
      const m = viewMode === 'month' ? currentMonth : currentDate.getMonth();
      const y = viewMode === 'month' ? currentYear : currentDate.getFullYear();
      const { start: ms, end: me } = getMonthRange(y, m);
      const startStr = format(ms, 'yyyy-MM-dd');
      const endStr = format(me, 'yyyy-MM-dd');

      const { data } = await supabase
        .from('schedule_entries')
        .select(`
          id, user_id, date, custom_start_time, custom_end_time,
          profiles:user_id (id, full_name, email),
          shift_definitions:shift_definition_id (id, name, start_time, end_time, color)
        `)
        .eq('user_id', stat.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date');

      await generatePdf(stat.name, m, y, (data || []) as unknown as ScheduleEntryRow[]);
    } catch (e) {
      console.error('PDF generation error:', e);
    } finally {
      setPdfLoading(null);
    }
  };

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
    ? `${formatDatePL(weekStart, 'd MMMM')} \u2013 ${formatDatePL(weekEnd, 'd MMMM yyyy')}`
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
          <p className="text-sm text-gray-500 mt-1">Podsumowanie godzin pracy, wynagrodze&#324; i eksport PDF</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 transition ${viewMode === 'week' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
              Tydzie&#324;
            </button>
            <button onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 transition ${viewMode === 'month' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
              Miesi&#261;c
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={goPrev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronLeft size={18} />
        </button>
        <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">Dzi&#347;</button>
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
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign size={12} /> Wynagrodzenia</div>
              <div className="text-2xl font-semibold text-gray-900">
                {totalSalaryAll > 0 ? `${totalSalaryAll.toFixed(2)} z\u0142` : '\u2014'}
              </div>
            </div>
          </div>

          {/* Shift type breakdown */}
          {Object.keys(shiftTotals).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Podzia\u0142 wg typu zmiany</h2>
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
                  <th className="text-center text-xs font-semibold text-gray-600 p-3 border-b border-gray-200 w-24">Stawka/h</th>
                  <th className="text-center text-xs font-semibold text-gray-600 p-3 border-b border-gray-200">Wynagrodzenie</th>
                  <th className="text-center text-xs font-semibold text-gray-600 p-3 border-b border-gray-200 w-12">PDF</th>
                </tr>
              </thead>
              <tbody>
                {employeeStats.map((stat) => {
                  const rate = rates[stat.id] || 0;
                  const salary = stat.totalHours * rate;
                  return (
                    <tr key={stat.id} className="hover:bg-gray-50/50">
                      <td className="p-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">{stat.name}</div>
                        <div className="text-xs text-gray-400">{stat.email}</div>
                        <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                          {Object.entries(stat.shifts).map(([name, data]) => (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                              style={{ backgroundColor: data.color + '20', color: data.color }}>
                              {name}: {data.count}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <span className="text-sm font-semibold text-gray-900">{stat.shiftCount}</span>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <span className="text-sm font-semibold text-gray-900">{stat.totalHours.toFixed(1)} h</span>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={rate || ''}
                          onChange={(e) => updateRate(stat.id, e.target.value)}
                          placeholder="0"
                          className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        />
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <span className={`text-sm font-semibold ${salary > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                          {salary > 0 ? `${salary.toFixed(2)} z\u0142` : '\u2014'}
                        </span>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <button
                          onClick={() => handlePdfExport(stat)}
                          disabled={pdfLoading === stat.id}
                          title="Eksportuj rejestr godzin (PDF)"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-amber-700 disabled:opacity-50"
                        >
                          <FileDown size={16} className={pdfLoading === stat.id ? 'animate-pulse' : ''} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-3 text-sm text-gray-700">Razem</td>
                  <td className="p-3 text-center text-sm text-gray-700">{totalShiftsAll}</td>
                  <td className="p-3 text-center text-sm text-gray-700">{totalHoursAll.toFixed(1)} h</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center text-sm text-green-700">
                    {totalSalaryAll > 0 ? `${totalSalaryAll.toFixed(2)} z\u0142` : '\u2014'}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
