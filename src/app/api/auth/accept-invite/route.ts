import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find invitation
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    // Check if token is expired (24 hours)
    const createdAt = new Date(invitation.created_at);
    const now = new Date();
    const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (diffHours > 24) {
      return NextResponse.json(
        { error: 'Invitation expired' },
        { status: 400 }
      );
    }

    // Update user role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: invitation.role })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Mark invitation as used
    const { error: markError } = await supabase
      .from('invitations')
      .update({ used: true })
      .eq('id', invitation.id);

    if (markError) throw markError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
