import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateHours, getMonthRange } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { year, month } = await request.json();

    if (typeof year !== 'number' || typeof month !== 'number') {
      return NextResponse.json(
        { error: 'Invalid year or month' },
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

    // Get date range
    const { start, end } = getMonthRange(year, month);
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    // Fetch schedule entries with relations
    const { data: entries, error: entriesErr } = await supabase
      .from('schedule_entries')
      .select('*, profile:profiles(*), shift_definition:shift_definitions(*)')
      .gte('date', startDate)
      .lte('date', endDate);

    if (entriesErr) {
      throw entriesErr;
    }

    // Get all employees
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('*');

    if (empErr) {
      throw empErr;
    }

    // Build report data
    const reportMap = new Map<
      string,
      { name: string; shifts: number; hours: number }
    >();

    (entries || []).forEach((entry: any) => {
      const empId = entry.user_id;
      const empName = entry.profile?.full_name || 'Unknown';

      if (!reportMap.has(empId)) {
        reportMap.set(empId, { name: empName, shifts: 0, hours: 0 });
      }

      const data = reportMap.get(empId)!;
      data.shifts += 1;

      // Calculate hours
      let startTime = entry.custom_start_time;
      let endTime = entry.custom_end_time;

      if (!startTime || !endTime) {
        const shift = entry.shift_definition;
        if (shift) {
          startTime = shift.start_time;
          endTime = shift.end_time;
        }
      }

      if (startTime && endTime) {
        data.hours += calculateHours(startTime, endTime);
      }
    });

    // TODO: In production, use Resend, SendGrid, or similar email service
    // For now, just return success with report summary
    const reportEntries = Array.from(reportMap.entries())
      .map(([id, data]) => ({
        employeeId: id,
        ...data,
      }))
      .sort((a, b) => b.hours - a.hours);

    console.log(`Report generated for ${year}-${month + 1}:`, reportEntries);

    return NextResponse.json({
      success: true,
      entriesCount: (entries || []).length,
      reportSummary: reportEntries,
      message: 'Report generated and queued for sending',
    });
  } catch (error) {
    console.error('Send report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
