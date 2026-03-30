'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addDays, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Pencil, Trash2, X as XIcon } from 'lucide-react';
import { getWeekRange, DAY_NAMES_PL, formatDatePL } from '@/lib/utils';
import type { Profile, ShiftDefinition, ScheduleEntry } from '@/lib/types';
import { useOrg } from '@/lib/OrgContext';

interface ScheduleEntryWithRelations extends ScheduleEntry {
  notes?: string | null;
  profiles: Pick<Profile, 'id' | 'full_name' | 'email'>;
  shift_definitions: Pick<ShiftDefinition, 'id' | 'name' | 'start_time' | 'end_time' | 'color'>;
}

/* ─── helpers ─── */

/** Convert "HH:MM" or "HH:MM:SS" to fractional hours */
function timeToHours(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

/** Determine the visible hour range for a day's entries (padded ±1 h) */
function dayBounds(entries: ScheduleEntryWithRelations[], fallbackStart = 7, fallbackEnd = 22) {
  if (entries.length === 0) return { startHour: fallbackStart, endHour: fallbackEnd };
  let min = 24;
  let max = 0;
  for (const e of entries) {
    const s = timeToHours(e.custom_start_time || e.shift_definitions?.start_time || '08:00');
    const en = timeToHours(e.custom_end_time || e.shift_definitions?.end_time || '16:00');
    if (s < min) min = s;
    if (en > max) max = en;
  }
  return {
    startHour: Math.max(0, Math.floor(min) - 1),
    endHour: Math.min(24, Math.ceil(max) + 1),
  };
}

/* ─── constants ─── */
const HOUR_HEIGHT = 56; // px per hour

/* ─── components ─── */

function TimelineBlock({
  entry,
  startHour,
  columnIndex,
  totalColumns,
  onClick,
}: {
  entry: ScheduleEntryWithRelations;
  startHour: number;
  columnIndex: number;
  totalColumns: number;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const shift = entry.shift_definitions;
  const sTime = entry.custom_start_time || shift?.start_time || '08:00';
  const eTime = entry.custom_end_time || shift?.end_time || '16:00';
  const color = shift?.color || '#3b82f6';
  const name = entry.profiles?.full_name || entry.profiles?.email || 'Pracownik';

  const topH = timeToHours(sTime) - startHour;
  const height = timeToHours(eTime) - timeToHours(sTime);

  const colWidth = 100 / totalColumns;

  const tooltipText = `${name}\n${sTime.slice(0, 5)} \u2013 ${eTime.slice(0, 5)}${shift?.name ? `\n${shift.name}` : ''}${entry.notes ? `\n${entry.notes}` : ''}`;

  return (
    <div
      className={`absolute rounded-lg overflow-visible text-xs group ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        top: `${topH * HOUR_HEIGHT}px`,
        height: `${Math.max(height * HOUR_HEIGHT - 2, 20)}px`,
        left: `${columnIndex * colWidth}%`,
        width: `${colWidth - 1}%`,
        zIndex: hovered ? 30 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      title={tooltipText}
    >
      {/* Block body */}
      <div
        className="rounded-lg h-full overflow-hidden transition-shadow group-hover:shadow-lg group-hover:ring-2 group-hover:ring-offset-1"
        style={{
          backgroundColor: color + '22',
          borderLeft: `3px solid ${color}`,
          '--tw-ring-color': color + '55',
        } as React.CSSProperties}
      >
        <div className="px-2 py-1.5 h-full flex flex-col">
          <div className="font-semibold truncate" style={{ color }}>
            {name}
          </div>
          <div className="text-gray-500 mt-0.5">
            {sTime.slice(0, 5)} &ndash; {eTime.slice(0, 5)}
          </div>
          {shift?.name && (
            <div className="text-gray-400 mt-auto truncate text-[10px]">
              {shift.name}
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip - positioned above the block */}
      {hovered && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none"
          style={{ zIndex: 50 }}
        >
          <div
            className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap"
            style={{ minWidth: '140px' }}
          >
            <div className="font-semibold">{name}</div>
            <div className="text-gray-300 mt-0.5">
              {sTime.slice(0, 5)} &ndash; {eTime.slice(0, 5)}
            </div>
            {shift?.name && (
              <div className="text-gray-400 mt-0.5">{shift.name}</div>
            )}
            {entry.notes && (
              <div className="text-gray-400 mt-1 italic">{entry.notes}</div>
            )}
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

function DayTimeline({
  day,
  dayIndex,
  entries,
  isToday,
  globalStartHour,
  globalEndHour,
  onEntryClick,
  onAddClick,
}: {
  day: Date;
  dayIndex: number;
  entries: ScheduleEntryWithRelations[];
  isToday: boolean;
  globalStartHour: number;
  globalEndHour: number;
  onEntryClick?: (entry: ScheduleEntryWithRelations) => void;
  onAddClick?: () => void;
}) {
  const totalHours = globalEndHour - globalStartHour;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => globalStartHour + i);

  // Assign columns: sort by start time, greedily assign to first non-overlapping column
  const sorted = [...entries].sort((a, b) => {
    const aS = timeToHours(a.custom_start_time || a.shift_definitions?.start_time || '08:00');
    const bS = timeToHours(b.custom_start_time || b.shift_definitions?.start_time || '08:00');
    return aS - bS;
  });

  const columns: { end: number }[] = [];
  const assignment = new Map<string, number>();

  for (const entry of sorted) {
    const s = timeToHours(entry.custom_start_time || entry.shift_definitions?.start_time || '08:00');
    const e = timeToHours(entry.custom_end_time || entry.shift_definitions?.end_time || '16:00');

    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c].end <= s) {
        columns[c].end = e;
        assignment.set(entry.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      assignment.set(entry.id, columns.length);
      columns.push({ end: e });
    }
  }

  const totalColumns = Math.max(columns.length, 1);

  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border overflow-visible ${
        isToday ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Day header */}
      <div
        className={`text-center py-2.5 border-b relative ${
          isToday
            ? 'bg-amber-100/60 border-amber-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className={`text-xs font-medium ${isToday ? 'text-amber-700' : 'text-gray-500'}`}>
          {DAY_NAMES_PL[dayIndex]?.slice(0, 3)}
        </div>
        <div className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-amber-800' : 'text-gray-900'}`}>
          {format(day, 'd')}
        </div>
        {onAddClick && (
          <button onClick={onAddClick}
            className="absolute top-1 right-1 p-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            title="Dodaj wpis">
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Timeline body */}
      <div className="relative" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
        {/* Hour grid lines */}
        {hours.slice(0, -1).map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-gray-100"
            style={{ top: `${(h - globalStartHour) * HOUR_HEIGHT}px` }}
          />
        ))}

        {/* Shift blocks */}
        <div className="absolute inset-0 px-0.5">
          {sorted.map((entry) => (
            <TimelineBlock
              key={entry.id}
              entry={entry}
              startHour={globalStartHour}
              columnIndex={assignment.get(entry.id) || 0}
              totalColumns={totalColumns}
              onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
            />
          ))}
        </div>

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-gray-300">&mdash;</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileDayTimeline({
  day,
  dayIndex,
  entries,
  isToday,
  globalStartHour,
  globalEndHour,
  onEntryClick,
  onAddClick,
}: {
  day: Date;
  dayIndex: number;
  entries: ScheduleEntryWithRelations[];
  isToday: boolean;
  globalStartHour: number;
  globalEndHour: number;
  onEntryClick?: (entry: ScheduleEntryWithRelations) => void;
  onAddClick?: () => void;
}) {
  const totalHours = globalEndHour - globalStartHour;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => globalStartHour + i);

  // Assign columns
  const sorted = [...entries].sort((a, b) => {
    const aS = timeToHours(a.custom_start_time || a.shift_definitions?.start_time || '08:00');
    const bS = timeToHours(b.custom_start_time || b.shift_definitions?.start_time || '08:00');
    return aS - bS;
  });

  const columns: { end: number }[] = [];
  const assignment = new Map<string, number>();

  for (const entry of sorted) {
    const s = timeToHours(entry.custom_start_time || entry.shift_definitions?.start_time || '08:00');
    const e = timeToHours(entry.custom_end_time || entry.shift_definitions?.end_time || '16:00');
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c].end <= s) {
        columns[c].end = e;
        assignment.set(entry.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      assignment.set(entry.id, columns.length);
      columns.push({ end: e });
    }
  }

  const totalColumns = Math.max(columns.length, 1);

  return (
    <div
      className={`rounded-xl border overflow-visible ${
        isToday ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Day header */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between border-b ${
          isToday
            ? 'bg-amber-100/60 border-amber-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <span className={`text-sm font-semibold ${isToday ? 'text-amber-800' : 'text-gray-900'}`}>
          {DAY_NAMES_PL[dayIndex]}
        </span>
        <div className="flex items-center gap-2">
          {onAddClick && (
            <button onClick={onAddClick}
              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
              title="Dodaj wpis">
              <Plus size={14} />
            </button>
          )}
          <span className={`text-xs ${isToday ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
            {format(day, 'dd.MM')}
            {isToday && ' \u2022 dzi\u015b'}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">
          Brak zaplanowanych zmian
        </div>
      ) : (
        <div className="flex">
          {/* Hour labels */}
          <div className="flex-shrink-0 w-11 border-r border-gray-100">
            {hours.slice(0, -1).map((h) => (
              <div
                key={h}
                className="text-[10px] text-gray-400 text-right pr-1.5 border-t border-gray-100"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Timeline area */}
          <div className="flex-1 relative" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
            {hours.slice(0, -1).map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: `${(h - globalStartHour) * HOUR_HEIGHT}px` }}
              />
            ))}
            <div className="absolute inset-0 px-1">
              {sorted.map((entry) => (
                <TimelineBlock
                  key={entry.id}
                  entry={entry}
                  startHour={globalStartHour}
                  columnIndex={assignment.get(entry.id) || 0}
                  totalColumns={totalColumns}
                  onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── edit modal (admin only) ─── */

interface EditModalProps {
  entry: ScheduleEntryWithRelations;
  shiftDefs: ShiftDefinition[];
  onClose: () => void;
  onSave: (id: string, data: { custom_start_time: string; custom_end_time: string; shift_definition_id: string | null }) => void;
  onDelete: (id: string) => void;
}

function EditEntryModal({ entry, shiftDefs, onClose, onSave, onDelete }: EditModalProps) {
  const shift = entry.shift_definitions;
  const [startTime, setStartTime] = useState(entry.custom_start_time || shift?.start_time || '08:00');
  const [endTime, setEndTime] = useState(entry.custom_end_time || shift?.end_time || '16:00');
  const [useShift, setUseShift] = useState<string | null>(entry.shift_definition_id);

  const handleShiftSelect = (shiftId: string) => {
    const s = shiftDefs.find((d) => d.id === shiftId);
    if (s) {
      setUseShift(shiftId);
      setStartTime(s.start_time);
      setEndTime(s.end_time);
    }
  };

  const handleCustom = () => {
    setUseShift(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Edytuj wpis</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XIcon size={16} /></button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          {entry.profiles?.full_name || entry.profiles?.email} — {format(new Date(entry.date + 'T00:00:00'), 'dd.MM.yyyy')}
        </p>

        {shiftDefs.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Zmiana</label>
            <div className="flex flex-wrap gap-1.5">
              {shiftDefs.map((s) => (
                <button key={s.id} onClick={() => handleShiftSelect(s.id)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition ${useShift === s.id ? 'ring-2 ring-offset-1' : ''}`}
                  style={{
                    backgroundColor: useShift === s.id ? s.color + '20' : undefined,
                    borderColor: s.color + '60',
                    color: s.color,
                    '--tw-ring-color': s.color,
                  } as React.CSSProperties}
                >
                  {s.name}
                </button>
              ))}
              <button onClick={handleCustom}
                className={`text-xs px-2.5 py-1 rounded-md border border-gray-300 transition ${useShift === null ? 'bg-gray-100 ring-2 ring-gray-400 ring-offset-1' : ''}`}>
                Własne
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Od</label>
            <input type="time" value={startTime.slice(0, 5)} onChange={(e) => { setStartTime(e.target.value); setUseShift(null); }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Do</label>
            <input type="time" value={endTime.slice(0, 5)} onChange={(e) => { setEndTime(e.target.value); setUseShift(null); }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSave(entry.id, { custom_start_time: startTime, custom_end_time: endTime, shift_definition_id: useShift })}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            <Pencil size={14} /> Zapisz
          </button>
          <button onClick={() => { if (window.confirm('Usunąć ten wpis z harmonogramu?')) onDelete(entry.id); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition">
            <Trash2 size={14} /> Usuń
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── add entry modal (admin only) ─── */

interface AddModalProps {
  date: Date;
  employees: Profile[];
  shiftDefs: ShiftDefinition[];
  onClose: () => void;
  onAdd: (data: { user_id: string; date: string; shift_definition_id: string | null; custom_start_time: string | null; custom_end_time: string | null }) => void;
}

function AddEntryModal({ date, employees, shiftDefs, onClose, onAdd }: AddModalProps) {
  const [userId, setUserId] = useState(employees[0]?.id || '');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [useShift, setUseShift] = useState<string | null>(null);

  const handleShiftSelect = (shiftId: string) => {
    const s = shiftDefs.find((d) => d.id === shiftId);
    if (s) {
      setUseShift(shiftId);
      setStartTime(s.start_time);
      setEndTime(s.end_time);
    }
  };

  const handleSubmit = () => {
    onAdd({
      user_id: userId,
      date: format(date, 'yyyy-MM-dd'),
      shift_definition_id: useShift,
      custom_start_time: useShift ? null : startTime,
      custom_end_time: useShift ? null : endTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Dodaj wpis</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XIcon size={16} /></button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          {DAY_NAMES_PL[date.getDay() === 0 ? 6 : date.getDay() - 1]}, {format(date, 'dd.MM.yyyy')}
        </p>

        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">Pracownik</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name || emp.email}</option>
            ))}
          </select>
        </div>

        {shiftDefs.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Zmiana</label>
            <div className="flex flex-wrap gap-1.5">
              {shiftDefs.map((s) => (
                <button key={s.id} onClick={() => handleShiftSelect(s.id)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition ${useShift === s.id ? 'ring-2 ring-offset-1' : ''}`}
                  style={{
                    backgroundColor: useShift === s.id ? s.color + '20' : undefined,
                    borderColor: s.color + '60',
                    color: s.color,
                    '--tw-ring-color': s.color,
                  } as React.CSSProperties}
                >
                  {s.name}
                </button>
              ))}
              <button onClick={() => setUseShift(null)}
                className={`text-xs px-2.5 py-1 rounded-md border border-gray-300 transition ${useShift === null ? 'bg-gray-100 ring-2 ring-gray-400 ring-offset-1' : ''}`}>
                Własne
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Od</label>
            <input type="time" value={startTime.slice(0, 5)} onChange={(e) => { setStartTime(e.target.value); setUseShift(null); }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Do</label>
            <input type="time" value={endTime.slice(0, 5)} onChange={(e) => { setEndTime(e.target.value); setUseShift(null); }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <button onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          <Plus size={14} /> Dodaj do harmonogramu
        </button>
      </div>
    </div>
  );
}

/* ─── main page ─── */

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<ScheduleEntryWithRelations[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([]);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntryWithRelations | null>(null);
  const [addingForDay, setAddingForDay] = useState<Date | null>(null);

  const supabase = createClient();
  const { orgId, userRole, userId: adminId } = useOrg();
  const isAdmin = userRole === 'admin';
  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const [entriesRes, employeesRes, shiftsRes] = await Promise.all([
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
        supabase
          .from('shift_definitions')
          .select('*')
          .order('start_time'),
      ]);

      if (entriesRes.data) {
        setEntries(entriesRes.data as unknown as ScheduleEntryWithRelations[]);
      }
      if (employeesRes.data) {
        setEmployees(employeesRes.data as Profile[]);
      }
      if (shiftsRes.data) {
        setShiftDefs(shiftsRes.data as ShiftDefinition[]);
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

  const handleSaveEntry = async (id: string, data: { custom_start_time: string; custom_end_time: string; shift_definition_id: string | null }) => {
    await supabase.from('schedule_entries').update({
      shift_definition_id: data.shift_definition_id,
      custom_start_time: data.shift_definition_id ? null : data.custom_start_time,
      custom_end_time: data.shift_definition_id ? null : data.custom_end_time,
    }).eq('id', id);
    setEditingEntry(null);
    fetchData();
  };

  const handleDeleteEntry = async (id: string) => {
    await supabase.from('schedule_entries').delete().eq('id', id);
    setEditingEntry(null);
    fetchData();
  };

  const handleAddEntry = async (data: { user_id: string; date: string; shift_definition_id: string | null; custom_start_time: string | null; custom_end_time: string | null }) => {
    await supabase.from('schedule_entries').insert([{ ...data, created_by: adminId, org_id: orgId }]);
    setAddingForDay(null);
    fetchData();
  };

  const entriesByDay = useMemo(() => {
    return weekDays.map((day) =>
      entries.filter((e) => isSameDay(new Date(e.date + 'T00:00:00'), day))
    );
  }, [entries, weekStart.getTime()]);

  // Compute global hour bounds across the whole week (for both desktop and mobile: uniform axis)
  const globalBounds = useMemo(() => {
    const all = entries.length > 0 ? dayBounds(entries) : { startHour: 7, endHour: 22 };
    return all;
  }, [entries]);

  const todayCheck = (day: Date) => isSameDay(day, new Date());

  // Hour labels for desktop
  const globalHours = Array.from(
    { length: globalBounds.endHour - globalBounds.startHour + 1 },
    (_, i) => globalBounds.startHour + i
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-amber-600" />
            Harmonogram
          </h1>
          <p className="text-gray-600 mt-1">
            Tygodniowy grafik zmian pracownik&oacute;w
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Poprzedni tydzie&#324;"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm font-medium"
          >
            Dzi&#347;
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Nast&#281;pny tydzie&#324;"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week range label */}
      <div className="mb-4 text-sm text-gray-500">
        {formatDatePL(weekStart, 'd MMMM')} &ndash; {formatDatePL(weekEnd, 'd MMMM yyyy')}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Wczytywanie harmonogramu...</div>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700 mb-1">Brak pracownik&oacute;w</p>
          <p>Dodaj pracownik&oacute;w, aby zobaczy&#263; harmonogram.</p>
        </div>
      ) : (
        <>
          {/* =================== MOBILE: vertical day timelines =================== */}
          <div className="lg:hidden space-y-3">
            {weekDays.map((day, i) => (
              <MobileDayTimeline
                key={i}
                day={day}
                dayIndex={i}
                entries={entriesByDay[i]}
                isToday={todayCheck(day)}
                globalStartHour={globalBounds.startHour}
                globalEndHour={globalBounds.endHour}
                onEntryClick={isAdmin ? (entry) => setEditingEntry(entry) : undefined}
                onAddClick={isAdmin ? () => setAddingForDay(day) : undefined}
              />
            ))}
          </div>

          {/* =================== DESKTOP: 7-column timeline =================== */}
          <div className="hidden lg:flex gap-0 overflow-x-auto">
            {/* Hour gutter */}
            <div className="flex-shrink-0 w-12 pt-[60px]">
              {globalHours.slice(0, -1).map((h) => (
                <div
                  key={h}
                  className="text-xs text-gray-400 text-right pr-2"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="flex-1 flex gap-1.5">
              {weekDays.map((day, i) => (
                <DayTimeline
                  key={i}
                  day={day}
                  dayIndex={i}
                  entries={entriesByDay[i]}
                  isToday={todayCheck(day)}
                  globalStartHour={globalBounds.startHour}
                  globalEndHour={globalBounds.endHour}
                  onEntryClick={isAdmin ? (entry) => setEditingEntry(entry) : undefined}
                  onAddClick={isAdmin ? () => setAddingForDay(day) : undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Admin modals */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          shiftDefs={shiftDefs}
          onClose={() => setEditingEntry(null)}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
        />
      )}
      {addingForDay && (
        <AddEntryModal
          date={addingForDay}
          employees={employees}
          shiftDefs={shiftDefs}
          onClose={() => setAddingForDay(null)}
          onAdd={handleAddEntry}
        />
      )}
    </div>
  );
}
