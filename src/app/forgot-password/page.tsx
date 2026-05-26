'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UtensilsCrossed, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();

    try {
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4">
            <UtensilsCrossed className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Odzyskiwanie hasła</h1>
          <p className="text-gray-500 mt-1">Wyślemy link do zresetowania hasła</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
            <div className="flex items-start gap-3 bg-green-50 text-green-800 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Link został wysłany</p>
                <p className="mt-1 text-green-700">
                  Sprawdź skrzynkę <strong>{email}</strong> (również folder spam). Kliknij link w wiadomości, aby ustawić nowe hasło.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="email@example.com"
                autoFocus
              />
            </div>
            {error && <div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-xl transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
              Wyślij link resetujący
            </button>
            <div className="text-center text-sm">
              <Link href="/login" className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Wróć do logowania
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
