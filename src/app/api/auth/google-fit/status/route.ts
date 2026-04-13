import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('google_fit_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }

  const connected = Boolean(
    data?.google_fit_refresh_token && String(data.google_fit_refresh_token).trim().length > 0
  );
  return NextResponse.json({ connected });
}
