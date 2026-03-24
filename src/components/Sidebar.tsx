'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coffee, LogOut, Menu, X } from 'lucide-react';
import type { Profile } from '@/lib/types';

export default function Sidebar() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(data as Profile);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen
            ? 'fixed inset-0 z-40 bg-white'
            : 'hidden lg:flex lg:w-64 lg:flex-col lg:h-screen'
        } flex-col border-r border-gray-200`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-2">
          <Coffee className="w-8 h-8 text-amber-600" />
          <span className="font-semibold text-gray-900">Café Scheduler</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-6 space-y-2">
          <Link
            href="/schedule"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            Harmonogram
          </Link>
          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
            >
              Panel Admin
            </Link>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-6 border-t border-gray-200">
          {profile && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900">
                {profile.full_name || profile.email}
              </p>
              <p className="text-xs text-gray-500">
                {profile.role === 'admin' ? 'Admin' : 'Pracownik'}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setMobileOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition text-sm"
          >
            <LogOut size={16} />
            Wyloguj się
          </button>
        </div>
      </aside>
    </>
  );
}
