'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { 
  Settings as SettingsIcon, Loader2, Sparkles, 
  Ruler, Scale, User as UserIcon, Activity,
  Zap, Dumbbell, Calendar, CheckCircle2, ChevronDown, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserNav from '../../components/UserNav';
import { AppearanceControls } from '../../components/AppearanceControls';
import { ProfileDataError } from '../../components/ProfileDataError';
import { useLocale } from '../../context/LocaleContext';
import { WEEKDAYS, gymDaysFromPlan, mergeWorkoutPlanWithGymSelection } from '../../utils/workoutPlan';
import { computeDailyTargets } from '../../utils/nutritionTargets';
import { buildWorkoutAgendaPrompt } from '../../utils/aiPrompts';

const CARDIO_OPTIONS = [
  { id: 'run', icon: '🏃' },
  { id: 'walk', icon: '🚶' },
  { id: 'cycle', icon: '🚴' },
  { id: 'swim', icon: '🏊' },
  { id: 'stairmaster', icon: '🪜' },
  { id: 'crossfit', icon: '🏋️' },
] as const;

function SettingsContent() {
  const { user, loading: authLoading } = useAuth();
  const { geminiApiKey, profile, updateProfile, updateProfileAndGoals, dataLoading, profileFetchError, refetchUserData } = useApp();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [localProfile, setLocalProfile] = useState<any>(profile);
  const [generatingDiet, setGeneratingDiet] = useState(false);
  const [generatingWorkout, setGeneratingWorkout] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [fitConnected, setFitConnected] = useState<boolean | null>(null);
  const [fitOAuthMessage, setFitOAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup/physical');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  useEffect(() => {
    if (!dataLoading && profile && profile.is_setup_complete && !hasLoadedInitial) {
      setLocalProfile(profile);
      if (profile.workout_plan) {
        setSelectedDays(gymDaysFromPlan(profile.workout_plan));
      }
      setHasLoadedInitial(true);
    }
  }, [profile, dataLoading, hasLoadedInitial]);

  useEffect(() => {
    if (!user?.id) return;
    if (searchParams.get('fit') === 'connected') return;
    void fetch('/api/auth/google-fit/status', { credentials: 'same-origin' })
      .then((r) => r.json() as Promise<{ connected?: boolean }>)
      .then((d) => setFitConnected(d.connected === true))
      .catch(() => setFitConnected(false));
  }, [user?.id, searchParams]);

  useEffect(() => {
    const fit = searchParams.get('fit');
    const err = searchParams.get('fit_error');
    if (fit === 'connected') {
      let cancelled = false;
      void (async () => {
        try {
          const r = await fetch('/api/auth/google-fit/status?verify=1', { credentials: 'same-origin' });
          const d = (await r.json()) as { connected?: boolean };
          if (cancelled) return;
          setFitConnected(d.connected === true);
          setFitOAuthMessage(d.connected ? t('settings.fitConnectedMsg') : t('settings.fitVerifyFail'));
        } catch {
          if (!cancelled) {
            setFitConnected(false);
            setFitOAuthMessage(t('settings.fitVerifyFail'));
          }
        } finally {
          if (!cancelled) router.replace('/settings');
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (err) {
      setFitOAuthMessage(t('settings.fitOAuthFail'));
      router.replace('/settings');
    }
  }, [searchParams, router, t]);

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

  const handleSaveProfile = async () => {
    const nextPlan = mergeWorkoutPlanWithGymSelection(selectedDays, localProfile.workout_plan);
    const nextProfile = { ...localProfile, workout_plan: nextPlan };
    setLocalProfile(nextProfile);
    await updateProfile(nextProfile);
    alert(t('settings.saved'));
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      const frequency = parseInt(localProfile.workout_frequency || 4);
      if (prev.length < frequency) return [...prev, day];
      return prev;
    });
  };

  const generateDietPlan = async () => {
    setGeneratingDiet(true);
    try {
      const goals = computeDailyTargets(localProfile);
      await updateProfileAndGoals(localProfile, goals);
      alert(t('settings.dietUpdated'));
    } catch (e) {
      alert(t('settings.genFailed'));
    }
    finally { setGeneratingDiet(false); }
  };

  const generateWorkoutPlan = async () => {
    if (!geminiApiKey) return alert(t('settings.aiKeyMissing'));
    if (selectedDays.length === 0) return alert(t('settings.selectGymDays'));
    setGeneratingWorkout(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
      const prompt = buildWorkoutAgendaPrompt({
        goal: localProfile.goal,
        selectedDays,
        durationHours: Number(localProfile.workout_duration) || 1,
        cardioPreference: localProfile.cardio_preference || 'run',
      });
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: [{ text: prompt }] });
      const text = result.text || '';
      const plan = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, { type?: string; activity?: string; details?: string }>;
      const merged = { ...localProfile, workout_plan: plan };
      await updateProfile(merged);
      setLocalProfile(merged);
      setSelectedDays(gymDaysFromPlan(plan));
      alert(t('settings.workoutUpdated'));
    } catch (e) {
      alert(t('settings.genFailed'));
    }
    finally { setGeneratingWorkout(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <UserNav />
      <header className="flex justify-between items-center">
        <h1 className="page-title flex items-center gap-2 text-3xl">
          <SettingsIcon /> {t('settings.title')}
        </h1>
        <button className="btn-primary py-2 px-6 rounded-full text-sm" onClick={handleSaveProfile}>
          {t('settings.saveChanges')}
        </button>
      </header>

      <AppearanceControls />

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-blue-400">
          <UserIcon size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{t('settings.biometrics')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="text-[10px] text-muted uppercase font-bold">{t('settings.gender')}</label>
            <div className="flex bg-white/5 rounded-xl border border-white/10 p-1 dark:bg-white/5">
              {(['male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setLocalProfile({ ...localProfile, gender: g })}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${localProfile.gender === g ? 'bg-blue-500 text-white' : 'text-muted'}`}
                >
                  {t(`settings.${g}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase font-bold block mb-4">
              {t('settings.age', { n: localProfile.age })}
            </label>
            <input type="range" min="13" max="100" value={localProfile.age || 25} onChange={e => setLocalProfile({...localProfile, age: e.target.value})} className="w-full custom-slider slider-amber" />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-muted uppercase font-bold block mb-4">
              {t('settings.weight', { n: localProfile.weight })}
            </label>
            <input type="range" min="40" max="150" step="0.5" value={localProfile.weight || 70} onChange={e => setLocalProfile({...localProfile, weight: e.target.value})} className="w-full custom-slider slider-emerald" />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-muted uppercase font-bold block mb-4">
              {t('settings.height', { n: localProfile.height })}
            </label>
            <input type="range" min="130" max="230" value={localProfile.height || 175} onChange={e => setLocalProfile({...localProfile, height: e.target.value})} className="w-full custom-slider slider-blue" />
          </div>
          <div className="col-span-2 pt-2">
            <label className="text-[10px] text-muted uppercase font-bold block mb-4">
              {t('settings.bodyFat', { n: localProfile.body_fat_percentage })}
            </label>
            <input type="range" min="3" max="50" step="0.5" value={localProfile.body_fat_percentage || 15} onChange={e => setLocalProfile({...localProfile, body_fat_percentage: parseFloat(e.target.value)})} className="w-full custom-slider slider-violet" />
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-cyan-400">
          <Link2 size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{t('settings.googleFit')}</h2>
        </div>
        <p className="text-xs text-muted mb-4 leading-relaxed">{t('settings.googleFitBlurb')}</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <a href="/api/auth/google-fit/start" className="btn-primary py-2 px-4 rounded-full text-sm inline-block text-center">
            {t('settings.connectGoogleFit')}
          </a>
          {fitConnected === true && (
            <span className="text-xs font-semibold text-emerald-400">{t('settings.connected')}</span>
          )}
          {fitConnected === false && <span className="text-xs text-muted">{t('settings.notConnected')}</span>}
        </div>
        {fitOAuthMessage && (
          <p className="text-xs text-amber-800 dark:text-amber-200/90 mb-4 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/10">
            {fitOAuthMessage}
            <button
              type="button"
              className="ml-2 text-muted hover:text-foreground underline text-[10px]"
              onClick={() => setFitOAuthMessage(null)}
            >
              {t('settings.dismiss')}
            </button>
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-muted uppercase font-bold">{t('settings.heightForSteps')}</label>
            <input
              type="number"
              step="0.001"
              min="0.5"
              max="2.72"
              className="input-field mt-1"
              placeholder={`Default: ${(Number(localProfile.height) || 175) / 100} m from height (cm)`}
              value={
                localProfile.height_m != null && Number.isFinite(Number(localProfile.height_m))
                  ? String(localProfile.height_m)
                  : ''
              }
              onChange={(e) => {
                const raw = e.target.value;
                setLocalProfile({
                  ...localProfile,
                  height_m: raw === '' ? null : parseFloat(raw),
                });
              }}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-emerald-400">
          <Dumbbell size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{t('settings.training')}</h2>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-muted uppercase font-bold block mb-4 text-blue-400">
                {t('settings.frequency', { n: localProfile.workout_frequency || 4 })}
              </label>
              <input type="range" min="1" max="7" value={localProfile.workout_frequency || 4} onChange={e => setLocalProfile({...localProfile, workout_frequency: parseInt(e.target.value)})} className="w-full custom-slider slider-blue" />
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase font-bold block mb-4 text-emerald-400">
                {t('settings.sessionTime', { n: localProfile.workout_duration || 1 })}
              </label>
              <input type="range" min="0.5" max="3" step="0.5" value={localProfile.workout_duration || 1} onChange={e => setLocalProfile({...localProfile, workout_duration: parseFloat(e.target.value)})} className="w-full custom-slider slider-emerald" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted uppercase font-bold block mb-4 italic">
              {t('settings.pickGymDays', { n: localProfile.workout_frequency || 4 })}
            </label>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map((day) => (
                <button key={day} onClick={() => toggleDay(day)} className={`p-2 text-[10px] font-bold rounded-lg border transition-all ${selectedDays.includes(day) ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-gray-500'}`}>{day.substring(0, 3)}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted uppercase font-bold block mb-4">{t('settings.cardioPreference')}</label>
            <div className="grid grid-cols-3 gap-2">
              {CARDIO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLocalProfile({ ...localProfile, cardio_preference: opt.id })}
                  className={`p-3 rounded-xl border flex flex-col items-center transition-all ${localProfile.cardio_preference === opt.id ? 'bg-violet-500/20 border-violet-500' : 'bg-white/5 border-white/10 text-muted'}`}
                >
                  <span className="text-xl mb-1">{opt.icon}</span>
                  <span className="text-[9px] font-bold uppercase">{t(`cardio.${opt.id}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
            onClick={generateWorkoutPlan}
            disabled={generatingWorkout}
          >
            {generatingWorkout ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Sparkles size={18} /> {t('settings.regenAgenda')}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-amber-400">
          <Activity size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{t('settings.nutrition')}</h2>
        </div>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] text-muted uppercase font-bold block mb-2">{t('settings.mainGoal')}</label>
            <select
              className="input-field appearance-none bg-white/5 border-white/10 dark:bg-white/5"
              value={localProfile.goal || 'maintain'}
              onChange={(e) => setLocalProfile({ ...localProfile, goal: e.target.value })}
            >
              <option value="lose">{t('settings.goalLose')}</option>
              <option value="maintain">{t('settings.goalMaintain')}</option>
              <option value="gain">{t('settings.goalGain')}</option>
              <option value="lose_gain">{t('settings.goalRecomp')}</option>
            </select>
          </div>
          <button
            className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
            onClick={generateDietPlan}
            disabled={generatingDiet}
          >
            {generatingDiet ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Sparkles size={18} /> {t('settings.updateNutrition')}
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Settings() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
