import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { refreshGoogleAccessToken } from '@/lib/googleFit/tokens';

export async function GET(req: NextRequest) {
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

  const token = data?.google_fit_refresh_token && String(data.google_fit_refresh_token).trim();
  const verify = req.nextUrl.searchParams.get('verify') === '1';

  if (!verify) {
    const connected = Boolean(token && token.length > 0);
    return NextResponse.json({ connected });
  }

  if (!token) {
    return NextResponse.json({ connected: false, verified: true });
  }

  try {
    await refreshGoogleAccessToken(token);
    return NextResponse.json({ connected: true, verified: true });
  } catch {
    await supabase
      .from('profiles')
      .update({ google_fit_refresh_token: null })
      .eq('user_id', user.id);
    return NextResponse.json({ connected: false, verified: true });
  }
}
