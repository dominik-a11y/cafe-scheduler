'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Trash2, Copy, Check, Mail, Loader2 } from 'lucide-react';
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
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [empRes, invRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('invitations').select('*').eq('used', false).order('created_at', { ascending: false }),
    ]);
    if (empRes.data) setEmployees(empRes.data as Profile[]);
    if (invRes.data) setInvitations(invRes.data as Invitation[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const getInviteLink = (token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/login?invite=${token}`;
  };

  const copyLink = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(getInviteLink(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showMessage('Nie udało się skopiować', 'error');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      // Get current session token for Edge Function auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showMessage('Brak sesji — zaloguj się ponownie', 'error');
        setSending(false);
        return;
      }

      // Call Supabase Edge Function to send invite email
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage('Błąd: ' + (data.error || 'Nieznany błąd'), 'error');
      } else {
        showMessage('Zaproszenie wysłane na ' + email + '! Pracownik otrzyma maila z linkiem.');
        setEmail('');
        setShowInvite(false);
        fetchData();
      }
    } catch (err) {
      showMessage('Błąd połączenia z serwerem', 'error');
    }

    setSending(false);
  };

  const deleteInvitation = async (id: string) => {
    const { error } = await supabase.from('invitations').delete().eq('id', id);
    if (error) {
      showMessage('Błąd usuwania: ' + error.message, 'error');
    } else {
      fetchData();
    }
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (id === currentUserId) {
      showMessage('Nie możesz usunąć samego siebie!', 'error');
      return;
    }
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć pracownika "${name}"? Ta operacja jest nieodwracalna.`);
    if (!confirmed) return;

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      showMessage('Błąd usuwania: ' + error.message, 'error');
    } else {
      fetchData();
    }
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

      {msg && (
        <div className={`mb-4 p-3 text-sm rounded-lg ${msgType === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="employee">Pracownik</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={sending}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {sending ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Pracownik otrzyma maila z linkiem do rejestracji.</p>
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
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {emp.role === 'admin' ? 'Admin' : 'Pracownik'}
              </span>
              {emp.id !== currentUserId && (
                <button onClick={() => deleteEmployee(emp.id, emp.full_name || emp.email)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition" title="Usuń pracownika">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Oczekujące zaproszenia ({invitations.length})</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                    <p className="text-xs text-gray-500">
                      Rola: {inv.role === 'admin' ? 'Admin' : 'Pracownik'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Oczekujące</span>
                    <button onClick={() => deleteInvitation(inv.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition" title="Usuń zaproszenie">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={getInviteLink(inv.token)}
                    className="flex-1 px-2 py-1.5 bg-white border border-amber-300 rounded text-xs text-gray-600 select-all"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition ${
                      copiedId === inv.id
                        ? 'bg-green-600 text-white'
                        : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    {copiedId === inv.id ? <><Check size={12} /> Skopiowano</> : <><Copy size={12} /> Kopiuj link</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
