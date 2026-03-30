'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import { SHIFT_COLORS } from '@/lib/utils';
import type { ShiftDefinition } from '@/lib/types';
import { useOrg } from '@/lib/OrgContext';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [color, setColor] = useState(SHIFT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { orgId } = useOrg();

  const fetchShifts = async () => {
    const { data } = await supabase.from('shift_definitions').select('*').order('start_time');
    if (data) setShifts(data as ShiftDefinition[]);
    setLoading(false);
  };

  useEffect(() => { fetchShifts(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('shift_definitions').insert([{ name, start_time: startTime, end_time: endTime, color, org_id: orgId }]);
    setName(''); setStartTime('08:00'); setEndTime('16:00'); setShowForm(false);
    setSaving(false);
    fetchShifts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć tę zmianę?')) return;
    await supabase.from('shift_definitions').delete().eq('id', id);
    fetchShifts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light">Definicje Zmian</h1>
          <p className="text-sm text-gray-500 mt-1">Zdefiniuj typy zmian dostępne w harmonogramie</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Nowa zmiana
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="np. Poranna" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Od</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Do</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kolor</label>
            <div className="flex gap-2">
              {SHIFT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Zapisz</button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Anuluj</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-12">Wczytywanie...</div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium text-gray-700 mb-1">Brak zdefiniowanych zmian</p>
          <p className="text-sm">Dodaj pierwszą zmianę klikając przycisk powyżej.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="p-2 text-gray-400 hover:text-red-600 transition">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
