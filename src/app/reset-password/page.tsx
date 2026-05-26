'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UtensilsCrossed, KeyRound, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?error=reset_link_invalid');
        return;
      }
      setPageLoading(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Hasła nie są identyczne');
      return;
    }

    if (password.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków');
      return;
    }

    setLoading(true);

    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;
      router.push('/schedule');
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4">
            <UtensilsCrossed className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ustaw nowe hasło</h1>
          <p className="text-gray-500 mt-1">Wpisz i potwierdź nowe hasło</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nowe hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              placeholder="Minimum 6 znaków"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Powtórz hasło</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              placeholder="Wpisz hasło ponownie"
            />
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-xl transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
            Zapisz nowe hasło
          </button>
        </form>
      </div>
    </div>
  );
}
