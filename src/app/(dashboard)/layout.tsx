'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
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

      // Ensure profile exists, create default admin if first user
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        // First user becomes admin
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id', { count: 'exact' });

        const isFirstUser = !allProfiles || allProfiles.length === 0;
        const role = isFirstUser ? 'admin' : 'employee';

        await supabase.from('profiles').insert([
          {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || '',
            role,
          },
        ]);
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Wczytywanie...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-8 p-8 max-w-7xl mx-auto">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
