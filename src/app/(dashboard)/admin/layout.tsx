'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Users, BarChart3, Settings } from 'lucide-react';

const navItems = [
  {
    href: '/admin/shifts',
    label: 'Definicje Zmian',
    icon: Clock,
  },
  {
    href: '/admin/hours',
    label: 'Godziny Otwarcia',
    icon: Settings,
  },
  {
    href: '/admin/employees',
    label: 'Pracownicy',
    icon: Users,
  },
  {
    href: '/admin/reports',
    label: 'Raporty',
    icon: BarChart3,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0">
        <div className="sticky top-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Panel Admin</h2>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
