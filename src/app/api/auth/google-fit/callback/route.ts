import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { exchangeCodeForTokens } from '@/lib/googleFit/tokens';

const STATE_COOKIE = 'google_fit_oauth_state';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=fit_session', req.nextUrl.origin));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state');
  const code = searchParams.get('code');
  const err = searchParams.get('error');

  cookieStore.delete(STATE_COOKIE);

  if (err) {
    return NextResponse.redirect(
      new URL(`/settings?fit_error=${encodeURIComponent(err)}`, req.nextUrl.origin)
    );
  }

  if (!savedState || !state || savedState !== state || !code) {
    return NextResponse.redirect(new URL('/settings?fit_error=invalid_state', req.nextUrl.origin));
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/google-fit/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (tokens.refresh_token) {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ google_fit_refresh_token: tokens.refresh_token })
        .eq('user_id', user.id)
        .select('user_id');

      if (error) {
        console.error('profiles update google_fit_refresh_token:', error);
        return NextResponse.redirect(
          new URL('/settings?fit_error=save_failed', req.nextUrl.origin)
        );
      }

      if (!updated?.length) {
        const { error: insErr } = await supabase.from('profiles').insert({
          user_id: user.id,
          google_fit_refresh_token: tokens.refresh_token,
          height: '',
          weight: '',
          age: '',
          gender: 'male',
          goal: 'maintain',
          is_setup_complete: false,
        });
        if (insErr) {
          console.error('profiles insert google_fit:', insErr);
          return NextResponse.redirect(
            new URL('/settings?fit_error=save_failed', req.nextUrl.origin)
          );
        }
      }
    } else {
      const { data: row } = await supabase
        .from('profiles')
        .select('google_fit_refresh_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!row?.google_fit_refresh_token) {
        return NextResponse.redirect(
          new URL(
            '/settings?fit_error=no_refresh_token_try_again',
            req.nextUrl.origin
          )
        );
      }
    }

    return NextResponse.redirect(new URL('/settings?fit=connected', req.nextUrl.origin));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'exchange_failed';
    return NextResponse.redirect(
      new URL(`/settings?fit_error=${encodeURIComponent(msg.slice(0, 80))}`, req.nextUrl.origin)
    );
  }
}
