import { getDaysInMonth } from 'date-fns';
import { MONTH_NAMES_PL, calculateHours } from '@/lib/utils';

export interface HoursPdfEntry {
  date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  shift_definitions: { start_time: string; end_time: string } | null;
}

async function loadFont(doc: any, url: string, fontName: string, style: string) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const fileName = `${fontName}-${style}.ttf`;
  doc.addFileToVFS(fileName, base64);
  doc.addFont(fileName, fontName, style);
}

export async function generateHoursRegistryPdf(
  employeeName: string,
  month: number,
  year: number,
  entries: HoursPdfEntry[],
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  await Promise.all([
    loadFont(doc, '/fonts/Roboto-Regular.ttf', 'Roboto', 'normal'),
    loadFont(doc, '/fonts/Roboto-Bold.ttf', 'Roboto', 'bold'),
  ]);

  doc.setFontSize(14);
  doc.setFont('Roboto', 'bold');
  doc.text('Rejestr godzin realizacji zlecenia', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('Roboto', 'normal');
  doc.text('Rozliczenie liczby godzin wykonywania usług do umowy zlecenia nr ....................', 14, 32);
  doc.text(`w ${MONTH_NAMES_PL[month].toLowerCase()} ${year}`, 14, 39);
  doc.text(`Zleceniobiorca: ${employeeName}`, 14, 46);

  const daysInMonth = getDaysInMonth(new Date(year, month));
  const tableBody: (string | number)[][] = [];
  let totalHours = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEntries = entries.filter((e) => e.date === dateStr);

    if (dayEntries.length === 0) {
      tableBody.push([`${day}.`, '', '', '']);
    } else {
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

  const totalStr = totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1);
  tableBody.push([{ content: 'Łącznie', styles: { fontStyle: 'bold' } } as any, { content: `${totalStr} h`, styles: { fontStyle: 'bold' } } as any, '', '']);

  (doc as any).autoTable({
    startY: 52,
    head: [['Dzień\nmiesiąca', 'Liczba godzin\nrealizacji zlecenia', 'Podpis\nzleceniobiorcy', 'Podpis\nzleceniodawcy']],
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
      font: 'Roboto',
      lineColor: [180, 180, 180],
      lineWidth: 0.3,
    },
    margin: { left: 14, right: 14 },
  });

  const fileName = `rejestr_godzin_${employeeName.replace(/\s+/g, '_')}_${MONTH_NAMES_PL[month].toLowerCase()}_${year}.pdf`;
  doc.save(fileName);
}
