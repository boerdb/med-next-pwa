import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { processMedicationReminderPush } from '@/lib/push/reminder-cron';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const querySecret = request.nextUrl.searchParams.get('secret');
  const auth = request.headers.get('authorization');
  const token = auth?.replace(/^Bearer\s+/i, '') ?? querySecret;

  if (secret && token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processMedicationReminderPush();
    return NextResponse.json(result);
  } catch (e) {
    console.error('cron check-reminders', e);
    return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 });
  }
}
