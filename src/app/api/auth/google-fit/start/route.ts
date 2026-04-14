import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { getGoogleFitRedirectUri } from '@/lib/googleFit/redirectUri';

const STATE_COOKIE = 'google_fit_oauth_state';
const SCOPE = 'https://www.googleapis.com/auth/fitness.activity.read';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL('/login', req.nextUrl.origin);
    login.searchParams.set('next', '/settings');
    return NextResponse.redirect(login);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const redirectUri = getGoogleFitRedirectUri(req);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url);
}
