'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserPlus } from 'lucide-react';
import type { Profile, Invitation } from '@/lib/types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const supabase = createClient();

  const fetchData = async () => {
    const [empRes, invRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('invitations').select('*').eq('used', false).order('created_at', { ascending: false }),
    ]);
    if (empRes.data) setEmployees(empRes.data as Profile[]);
    if (invRes.data) setInvitations(invRes.data as Invitation[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const token = crypto.randomUUID();
    const { error } = await supabase.from('invitations').insert([{ email, role, token }]);
    if (error) {
      setMsg('Błąd: ' + error.message);
    } else {
      setMsg('Zaproszenie utworzone!');
      setEmail(''); setShowInvite(false);
      fetchData();
    }
    setSending(false);
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Wczytywanie...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light">Pracownicy</h1>
          <p className="text-sm text-gray-500 mt-1">Zarządzaj pracownikami i zaproszeniami</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          <UserPlus size={16} /> Zaproś
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{msg}</div>}

      {showInvite && (
        <form onSubmit={handleInvite} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg flex flex-col sm:flex-row gap-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="employee">Pracownik</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Wyślij</button>
        </form>
      )}

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Aktywni ({employees.length})</h2>
      <div className="space-y-2 mb-8">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">{emp.full_name || emp.email}</p>
              <p className="text-xs text-gray-500">{emp.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
              {emp.role === 'admin' ? 'Admin' : 'Pracownik'}
            </span>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Oczekujące zaproszenia ({invitations.length})</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-500">Token: {inv.token.slice(0, 8)}...</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Oczekujące</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
