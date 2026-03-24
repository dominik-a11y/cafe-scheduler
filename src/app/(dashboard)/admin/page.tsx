'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Clock, Users, BarChart3, Settings } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    shifts: 0,
    employees: 0,
    pendingInvites: 0,
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [shiftRes, empRes, invRes] = await Promise.all([
          supabase.from('shift_definitions').select('id', { count: 'exact' }),
          supabase.from('profiles').select('id', { count: 'exact' }),
          supabase
            .from('invitations')
            .select('id', { count: 'exact' })
            .eq('used', false),
        ]);

        setStats({
          shifts: shiftRes.count || 0,
          employees: empRes.count || 0,
          pendingInvites: invRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const tiles = [
    {
      title: 'Definicje Zmian',
      icon: Clock,
      href: '/admin/shifts',
      value: stats.shifts,
      color: 'from-blue-50 to-blue-100',
    },
    {
      title: 'Pracownicy',
      icon: Users,
      href: '/admin/employees',
      value: stats.employees,
      color: 'from-green-50 to-green-100',
    },
    {
      title: 'Oczekujące Zaproszenia',
      icon: Users,
      href: '/admin/employees',
      value: stats.pendingInvites,
      color: 'from-amber-50 to-amber-100',
    },
    {
      title: 'Godziny Otwarcia',
      icon: Settings,
      href: '/admin/hours',
      value: '7 dni',
      color: 'from-purple-50 to-purple-100',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-light">Panel Administracyjny</h1>
        <p className="text-gray-600 mt-1">
          Zarządzaj zmianami, pracownikami i godzinami otwarcia
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Wczytywanie...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`p-6 rounded-lg bg-gradient-to-br ${tile.color} border border-gray-200 hover:border-gray-300 hover:shadow-md transition cursor-pointer group`}
              >
                <Icon
                  size={24}
                  className="text-gray-700 mb-3 group-hover:text-gray-900 transition"
                />
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  {tile.title}
                </h3>
                <p className="text-2xl font-light text-gray-900">
                  {typeof tile.value === 'number' && !loading
                    ? tile.value
                    : tile.value}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Szybkie Linki</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/shifts"
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition"
            >
              <h3 className="font-medium text-gray-900 mb-1">Zarządzaj Zmianami</h3>
              <p className="text-sm text-gray-600">
                Dodaj, edytuj i usuń definicje zmian
              </p>
            </Link>
            <Link
              href="/admin/employees"
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition"
            >
              <h3 className="font-medium text-gray-900 mb-1">Zaproś Pracowników</h3>
              <p className="text-sm text-gray-600">
                Wyślij zaproszenia i zarządzaj rolami
              </p>
            </Link>
            <Link
              href="/admin/hours"
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition"
            >
              <h3 className="font-medium text-gray-900 mb-1">Godziny Otwarcia</h3>
              <p className="text-sm text-gray-600">
                Ustaw godziny dla każdego dnia tygodnia
              </p>
            </Link>
            <Link
              href="/admin/reports"
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition"
            >
              <h3 className="font-medium text-gray-900 mb-1">Raporty</h3>
              <p className="text-sm text-gray-600">
                Przejrzyj podsumowania godzin pracy
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
