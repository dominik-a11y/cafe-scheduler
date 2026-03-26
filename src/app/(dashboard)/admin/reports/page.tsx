'use client';

import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="text-center py-16">
      <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <h1 className="text-2xl font-light text-gray-700 mb-2">Raporty</h1>
      <p className="text-gray-500">Ta sekcja jest w budowie.</p>
      <p className="text-sm text-gray-400 mt-2">Tutaj pojawią się podsumowania godzin pracy i statystyki zmian.</p>
    </div>
  );
}
