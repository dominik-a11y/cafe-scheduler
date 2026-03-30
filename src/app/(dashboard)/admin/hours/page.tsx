'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES_PL } from '@/lib/utils';
import type { CafeHours } from '@/lib/types';

export default function HoursPage() {
  const [hours, setHours] = useState<CafeHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('cafe_hours').select('*').order('day_of_week');
      if (data) setHours(data as CafeHours[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const updateField = (idx: number, field: string, value: string | boolean) => {
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    for (const h of hours) {
      await supabase.from('cafe_hours').update({
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }).eq('id', h.id);
    }
    setSaving(false);
    setMsg('Zapisano!');
    setTimeout(() => setMsg(''), 2000);
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Wczytywanie...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-light">Godziny Otwarcia</h1>
        <p className="text-sm text-gray-500 mt-1">Ustaw godziny otwarcia lokalu dla każdego dnia tygodnia</p>
      </div>

      <div className="space-y-3">
        {hours.map((h, idx) => (
          <div key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="w-32 font-medium text-sm text-gray-900">{DAY_NAMES_PL[h.day_of_week]}</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={h.is_closed} onChange={(e) => updateField(idx, 'is_closed', e.target.checked)}
                className="rounded" />
              Zamknięte
            </label>
            {!h.is_closed && (
              <div className="flex items-center gap-2">
                <input type="time" value={h.open_time} onChange={(e) => updateField(idx, 'open_time', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm" />
                <span className="text-gray-400">–</span>
                <input type="time" value={h.close_time} onChange={(e) => updateField(idx, 'close_time', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>
    </div>
  );
}
