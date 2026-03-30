import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, fullName, orgName } = await request.json();

    if (!email || !password || !fullName || !orgName) {
      return NextResponse.json({ error: 'Wszystkie pola są wymagane' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Hasło musi mieć minimum 6 znaków' }, { status: 400 });
    }

    // Use service role client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Create organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: orgName })
      .select('id')
      .single();

    if (orgError) {
      return NextResponse.json({ error: 'Błąd tworzenia organizacji: ' + orgError.message }, { status: 500 });
    }

    // 2. Create user with metadata (trigger will create profile)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin',
        org_id: org.id,
      },
    });

    if (userError) {
      // Rollback org creation
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // 3. Set owner_id on organization
    await supabaseAdmin
      .from('organizations')
      .update({ owner_id: userData.user.id })
      .eq('id', org.id);

    // 4. Seed default cafe_hours (7 days)
    const defaultHours = Array.from({ length: 7 }, (_, i) => ({
      org_id: org.id,
      day_of_week: i,
      open_time: '08:00',
      close_time: '20:00',
      is_closed: false,
    }));

    await supabaseAdmin.from('cafe_hours').insert(defaultHours);

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Wystąpił błąd' }, { status: 500 });
  }
}
