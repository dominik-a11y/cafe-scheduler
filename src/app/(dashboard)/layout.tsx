'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { OrgContext } from '@/lib/OrgContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<{ orgId: string; userRole: 'admin' | 'employee'; userId: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        // Profile should exist from trigger; if not, redirect to complete-profile
        router.push('/complete-profile');
        return;
      }

      setOrgData({
        orgId: profile.org_id,
        userRole: profile.role as 'admin' | 'employee',
        userId: session.user.id,
      });
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading || !orgData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Wczytywanie...</div>
      </div>
    );
  }

  return (
    <OrgContext.Provider value={orgData}>
      <div className="flex gap-4 p-4 lg:gap-6 lg:p-6 max-w-7xl mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 pt-10 lg:pt-0">{children}</main>
      </div>
    </OrgContext.Provider>
  );
}
