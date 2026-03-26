import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól' },
        { status: 400 }
      );
    }

    // Verify admin via session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use Supabase Admin to send invite email
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Brak klucza service_role. Ustaw SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
      data: { role },
    });

    if (inviteError) {
      console.error('Supabase invite error:', inviteError);
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      );
    }

    // Also save in invitations table for tracking
    const token = crypto.randomUUID();
    await supabase.from('invitations').insert([{ email, role, token }]);

    return NextResponse.json({
      success: true,
      message: `Zaproszenie wysłane na ${email}`,
    });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Wewnętrzny błąd serwera' },
      { status: 500 }
    );
  }
}
