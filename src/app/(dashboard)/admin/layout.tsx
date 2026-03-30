'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Users, BarChart3, Settings, ClipboardCheck } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Przegląd', icon: BarChart3, exact: true },
  { href: '/admin/shifts', label: 'Zmiany', icon: Clock },
  { href: '/admin/hours', label: 'Godziny', icon: Settings },
  { href: '/admin/employees', label: 'Pracownicy', icon: Users },
  { href: '/admin/availability', label: 'Dyspozycyjność', icon: ClipboardCheck },
  { href: '/admin/reports', label: 'Raporty', icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="w-full">
      {/* Horizontal tab navigation */}
      <nav className="flex gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1 pr-12 lg:pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
