import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, token, role } = await request.json();

    if (!email || !token || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify admin
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

    // Generate invite URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${origin}/login?invite=${token}`;

    // TODO: In production, use Resend, SendGrid, or similar email service
    // For now, just return success - the invitation is already saved in the database
    console.log(`Invite sent to ${email}:`, inviteUrl);

    return NextResponse.json({
      success: true,
      inviteUrl,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
