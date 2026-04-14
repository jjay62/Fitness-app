import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { refreshGoogleAccessToken } from '@/lib/googleFit/tokens';
import { fetchAggregatedStepsForRange } from '@/lib/googleFit/aggregateSteps';

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dayYMD =
      searchParams.get('date')?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const forceRefresh = searchParams.get('refresh') === '1';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYMD)) {
      return NextResponse.json({ error: 'Invalid date (use YYYY-MM-DD)' }, { status: 400 });
    }

    const startMsParam = searchParams.get('startMs');
    const endMsParam = searchParams.get('endMs');
    let startTimeMillis: number;
    let endTimeMillis: number;

    if (startMsParam && endMsParam) {
      startTimeMillis = parseInt(startMsParam, 10);
      endTimeMillis = parseInt(endMsParam, 10);
      if (!Number.isFinite(startTimeMillis) || !Number.isFinite(endTimeMillis) || endTimeMillis <= startTimeMillis) {
        return NextResponse.json({ error: 'Invalid startMs/endMs' }, { status: 400 });
      }
    } else {
      const [y, m, d] = dayYMD.split('-').map((x) => parseInt(x, 10));
      startTimeMillis = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
      endTimeMillis = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
    }

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('strava_daily_steps')
        .select('steps, updated_at')
        .eq('user_id', user.id)
        .eq('day', dayYMD)
        .maybeSingle();

      if (cached?.updated_at) {
        const age = Date.now() - new Date(cached.updated_at).getTime();
        if (age >= 0 && age < CACHE_TTL_MS) {
          return NextResponse.json({
            steps: cached.steps,
            date: dayYMD,
            cached: true,
            source: 'google_fit',
          });
        }
      }
    }

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('google_fit_refresh_token')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const refreshToken = profile?.google_fit_refresh_token as string | undefined;
    if (!refreshToken?.trim()) {
      return NextResponse.json(
        {
          error: 'Google Fit not connected. Connect in Settings.',
          steps: 0,
          date: dayYMD,
          source: 'google_fit',
        },
        { status: 200 }
      );
    }

    const { access_token } = await refreshGoogleAccessToken(refreshToken.trim());
    const totalSteps = await fetchAggregatedStepsForRange(
      access_token,
      startTimeMillis,
      endTimeMillis
    );

    const { error: upErr } = await supabase.from('strava_daily_steps').upsert(
      {
        user_id: user.id,
        day: dayYMD,
        steps: totalSteps,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' }
    );

    if (upErr) {
      console.warn('steps cache upsert:', upErr.message);
    }

    return NextResponse.json({
      steps: totalSteps,
      date: dayYMD,
      cached: false,
      source: 'google_fit',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg, source: 'google_fit' }, { status: 502 });
  }
}
