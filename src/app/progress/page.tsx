'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';
import { Loader2, TrendingUp, Scale, Dumbbell } from 'lucide-react';
import { motion } from 'framer-motion';
import UserNav from '@/components/UserNav';
import { ProfileDataError } from '@/components/ProfileDataError';
import {
  HORIZON_MONTHS,
  type HorizonMonths,
  parseNum,
  estimateTdee,
  averageDailyKcalFromLogs,
  monthlyWeightDeltaKg,
  buildProjectionSeries,
} from '@/utils/weightProjection';
import { buildStrengthMuscleSeries, strengthNarrative } from '@/utils/strengthProjection';
import { computeDailyTargets } from '@/utils/nutritionTargets';

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
type NarrativeCopy = { outlook: string; appearance: string; benefits: string; disclaimer: string };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    geminiApiKey,
    profile,
    recentMealLogs7d,
    weightEntries,
    addWeightEntry,
    dataLoading,
    profileFetchError,
    refetchUserData,
  } = useApp();
  const router = useRouter();

  const [horizon, setHorizon] = useState<HorizonMonths>(6);
  const [weightInput, setWeightInput] = useState('');
  const [logging, setLogging] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<NarrativeCopy | null>(null);
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) router.push('/login');
      else if (profile && !profile.is_setup_complete) router.push('/setup');
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  const tdee = useMemo(() => estimateTdee(profile), [profile]);
  const computedTargets = useMemo(() => computeDailyTargets(profile), [profile]);

  const intakeInfo = useMemo(() => {
    const fromLogs = averageDailyKcalFromLogs(recentMealLogs7d, 7);
    if (fromLogs) {
      return { avg: fromLogs.avg, usedFallback: false };
    }
    return { avg: computedTargets.kcal, usedFallback: true };
  }, [recentMealLogs7d, computedTargets.kcal]);

  const dailyBalance = useMemo(() => intakeInfo.avg - tdee, [intakeInfo.avg, tdee]);
  const monthlyDelta = useMemo(() => monthlyWeightDeltaKg(dailyBalance), [dailyBalance]);

  const w0 = useMemo(() => {
    if (weightEntries.length > 0) {
      return weightEntries[weightEntries.length - 1].weight_kg;
    }
    return parseNum(profile.weight, 70);
  }, [weightEntries, profile.weight]);

  const projectionPoints = useMemo(() => {
    const series = buildProjectionSeries(w0, horizon, monthlyDelta);
    return series.map((p) => ({
      month: p.month,
      label: p.month === 0 ? 'Now' : `+${p.month}mo`,
      projected: p.weight,
    }));
  }, [w0, horizon, monthlyDelta]);

  const historyPoints = useMemo(() => {
    const t0 = startOfToday().getTime();
    return weightEntries
      .map((e) => {
        const xMonth = (new Date(e.logged_at).getTime() - t0) / MS_PER_MONTH;
        return {
          month: Math.round(xMonth * 100) / 100,
          label: new Date(e.logged_at).toLocaleDateString(),
          logged: e.weight_kg,
        };
      })
      .sort((a, b) => a.month - b.month);
  }, [weightEntries]);

  const xDomain = useMemo(() => {
    const hs = historyPoints.map((h) => h.month);
    const minM = hs.length ? Math.min(0, ...hs) : 0;
    const maxM = Math.max(horizon, ...(hs.length ? hs : [0]));
    return [minM - 0.25, maxM + 0.25] as [number, number];
  }, [historyPoints, horizon]);

  const roundedStartKg = Math.round(w0 * 10) / 10;
  const roundedEndKg = Math.round((w0 + horizon * monthlyDelta) * 10) / 10;

  useEffect(() => {
    if (!geminiApiKey || authLoading || dataLoading || !profile?.is_setup_complete) {
      return;
    }
    let cancelled = false;
    setAiNarrativeLoading(true);

    const recentWeights = [...weightEntries]
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
      .slice(0, 6)
      .map((e) => `${new Date(e.logged_at).toLocaleDateString()}: ${e.weight_kg}kg`)
      .join(', ');

    const prompt = `
Act as a knowledgeable fitness coach giving an honest 6-month progress outlook.
Write a concise and practical 6-month progress narrative for this user.
Do NOT show formulas, equations, or step-by-step calculations.
Avoid fake precision and avoid overconfidence.

Return pure JSON only:
{"outlook":"","appearance":"","benefits":"","disclaimer":""}

User profile:
- Goal: ${profile.goal || 'maintain'}
- Gender: ${profile.gender || 'unspecified'}
- Age: ${profile.age || 'unknown'}
- Height cm: ${profile.height || 'unknown'}
- Current weight kg: ${roundedStartKg}
- Estimated 6-month weight range center: ${roundedEndKg}
- Workout frequency days/week: ${profile.workout_frequency ?? 4}
- Cardio preference: ${profile.cardio_preference || 'run'}
- Computed daily calorie target (authoritative): ${computedTargets.kcal}
- Computed daily protein target: ${computedTargets.protein}g
- Stored app calorie goal may be stale and is non-authoritative.
- Average logged intake (recent): ${Math.round(intakeInfo.avg)} kcal
- Estimated daily burn: ${Math.round(tdee)} kcal
- Daily balance estimate: ${Math.round(dailyBalance)} kcal
- Recent logged weights: ${recentWeights || 'none'}
- Forecast horizon months: ${horizon}
- Intake estimate uses calorie-goal fallback: ${intakeInfo.usedFallback ? 'yes' : 'no'}

Rules:
- Tone: honest, grounded, motivating.
- Mention uncertainty and that results depend on consistency.
- Keep each field under 2 sentences.
- Do not treat stored database calorie goals as ground truth.
- disclaimer must say this is guidance and not medical advice.
    `.trim();

    void (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: [{ text: prompt }],
        });
        const text = (result.text || '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text) as Partial<NarrativeCopy>;
        if (cancelled) return;
        setAiNarrative({
          outlook: parsed.outlook || 'Your trajectory is moving in the right direction with consistent nutrition and training.',
          appearance: parsed.appearance || 'Visible changes are usually gradual and depend on training quality, sleep, and daily adherence.',
          benefits: parsed.benefits || 'Steady habits tend to improve energy, routine consistency, and long-term body composition outcomes.',
          disclaimer: parsed.disclaimer || 'Guidance only, not medical advice.',
        });
      } catch {
        if (!cancelled) {
          setAiNarrative({
            outlook: 'Your forecast is directionally useful, but real results depend on day-to-day consistency and logging quality.',
            appearance: 'Body changes are typically gradual and can vary with sleep, stress, and training execution.',
            benefits: 'Consistent nutrition, activity, and recovery are usually the strongest predictors of progress.',
            disclaimer: 'This is general guidance and not medical advice.',
          });
        }
      } finally {
        if (!cancelled) setAiNarrativeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    geminiApiKey,
    authLoading,
    dataLoading,
    profile?.is_setup_complete,
    profile.goal,
    profile.gender,
    profile.age,
    profile.height,
    profile.workout_frequency,
    profile.cardio_preference,
    computedTargets.kcal,
    computedTargets.protein,
    intakeInfo.avg,
    intakeInfo.usedFallback,
    tdee,
    dailyBalance,
    roundedStartKg,
    roundedEndKg,
    weightEntries,
    horizon,
  ]);

  const strengthSeries = useMemo(
    () =>
      buildStrengthMuscleSeries(horizon, {
        weightKg: w0,
        goal: profile.goal,
        sessionsPerWeek: parseNum(profile.workout_frequency, 4),
        proteinGPerDay: computedTargets.protein,
        calorieSurplusPerDay: dailyBalance,
      }),
    [horizon, w0, profile.goal, profile.workout_frequency, computedTargets.protein, dailyBalance]
  );

  const submitWeight = async () => {
    const v = parseFloat(weightInput);
    if (!Number.isFinite(v)) {
      alert('Enter a valid number');
      return;
    }
    setLogging(true);
    try {
      await addWeightEntry(v);
      setWeightInput('');
    } finally {
      setLogging(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!dataLoading && profileFetchError) {
    return (
      <ProfileDataError message={profileFetchError} onRetry={() => void refetchUserData()} />
    );
  }

  if (dataLoading || !profile?.is_setup_complete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-6">
      <UserNav />
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
          <TrendingUp size={24} />
        </div>
        <div>
          <h1 className="page-title text-2xl">Progress</h1>
          <p className="text-gray-400 text-sm">Track weight and see simple projections</p>
        </div>
      </header>

      <div className="glass-panel space-y-3">
        <label className="text-[10px] text-gray-500 uppercase font-bold">Forecast length</label>
        <select
          className="input-field appearance-none"
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value) as HorizonMonths)}
        >
          {HORIZON_MONTHS.map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Est. daily burn: <span className="text-gray-300 font-medium">{Math.round(tdee)}</span> kcal · Average
          intake: <span className="text-gray-300 font-medium">{Math.round(intakeInfo.avg)}</span> kcal
          {intakeInfo.usedFallback ? ' (using your computed target)' : ''}
        </p>
      </div>

      <div className="glass-panel space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Scale size={18} className="text-blue-400" />
          Log weight (kg)
        </h2>
        <p className="text-xs text-gray-500">Log weight here to build your chart over time.</p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder="e.g. 72.5"
            className="input-field flex-1"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button
            type="button"
            disabled={logging}
            onClick={() => void submitWeight()}
            className="btn-primary px-5 rounded-xl shrink-0"
          >
            {logging ? <Loader2 className="animate-spin" size={20} /> : 'Save'}
          </button>
        </div>
        {weightEntries.length > 0 && (
          <ul className="text-xs text-gray-400 space-y-1 max-h-28 overflow-y-auto border-t border-white/10 pt-3">
            {[...weightEntries]
              .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
              .slice(0, 8)
              .map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{new Date(e.logged_at).toLocaleString()}</span>
                  <span className="text-white font-medium">{e.weight_kg} kg</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="glass-panel h-[320px] w-full">
        <p className="text-xs text-gray-500 mb-2">Weight (kg) over time</p>
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="month"
              type="number"
              domain={xDomain}
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              domain={['auto', 'auto']}
              label={{ value: 'kg', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Line
              name="Projected"
              data={projectionPoints}
              type="monotone"
              dataKey="projected"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            {historyPoints.length > 0 && (
              <Line
                name="Logged"
                data={historyPoints}
                type="monotone"
                dataKey="logged"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: '#f59e0b' }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-panel h-[340px] w-full">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
          <Dumbbell size={18} className="text-violet-400" />
          Strength &amp; muscle
        </h2>
        <p className="text-[11px] text-gray-500 mb-2 leading-snug">Simple trend for motivation.</p>
        <ResponsiveContainer width="100%" height="78%">
          <ComposedChart margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, horizon]}
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <YAxis
              yAxisId="left"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              domain={['auto', 'auto']}
              label={{ value: 'Index', angle: -90, position: 'insideLeft', fill: '#a78bfa', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              domain={['auto', 'auto']}
              label={{ value: 'kg', angle: 90, position: 'insideRight', fill: '#34d399', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Line
              yAxisId="left"
              name="Strength"
              data={strengthSeries}
              type="monotone"
              dataKey="strengthIndex"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              name="Lean mass (est.)"
              data={strengthSeries}
              type="monotone"
              dataKey="leanMassKg"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{strengthNarrative()}</p>
      </div>

      <div className="glass-panel space-y-4 text-sm text-gray-300 leading-relaxed">
        <h3 className="text-white font-semibold text-base">Outlook</h3>
        <p>{aiNarrativeLoading ? 'Generating a personalized outlook...' : aiNarrative?.outlook}</p>
        <h3 className="text-white font-semibold text-base pt-2">How you might look</h3>
        <p>{aiNarrativeLoading ? 'Analyzing likely visual changes...' : aiNarrative?.appearance}</p>
        <h3 className="text-white font-semibold text-base pt-2">Health trajectory (general)</h3>
        <p>{aiNarrativeLoading ? 'Preparing likely health trajectory...' : aiNarrative?.benefits}</p>
        <p className="text-xs text-amber-200/80 border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 mt-2">
          {aiNarrativeLoading ? 'Guidance only — not medical advice.' : aiNarrative?.disclaimer}
        </p>
      </div>
    </motion.div>
  );
}
