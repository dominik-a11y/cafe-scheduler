import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse } from 'date-fns';
import { pl } from 'date-fns/locale';

export const SHIFT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

export const DAY_NAMES_PL = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthRange(year: number, month: number) {
  const date = new Date(year, month, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
}

export function formatDatePL(date: Date, formatStr: string = 'dd MMMM yyyy') {
  return format(date, formatStr, { locale: pl });
}

export function calculateHours(startTime: string, endTime: string): number {
  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);

  const startTotalMins = startHours * 60 + startMins;
  const endTotalMins = endHours * 60 + endMins;

  let diff = endTotalMins - startTotalMins;
  if (diff < 0) diff += 24 * 60;

  return diff / 60;
}
