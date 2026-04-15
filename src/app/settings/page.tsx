'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { 
  Settings as SettingsIcon, Loader2, Sparkles, 
  Ruler, Scale, User as UserIcon, Activity,
  Zap, Dumbbell, Calendar, CheckCircle2, ChevronDown, Link2, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserNav from '../../components/UserNav';
import { AppearanceControls } from '../../components/AppearanceControls';
import { ProfileDataError } from '../../components/ProfileDataError';
import { useLocale } from '../../context/LocaleContext';
import { WEEKDAYS, gymDaysFromPlan, mergeWorkoutPlanWithGymSelection } from '../../utils/workoutPlan';
import { generateNutritionTargetsWithGemini } from '../../utils/nutritionTargets';
import { buildWorkoutAgendaPrompt } from '../../utils/aiPrompts';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_NOTIFICATION_PREFS,
  readNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notificationPrefs';

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
  const { geminiApiKey, profile, updateProfile, dataLoading, profileFetchError, refetchUserData } = useApp();
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

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
    setNotificationPrefs(readNotificationPrefs(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (searchParams.get('fit') === 'connected') return;
    void fetch('/api/auth/google-fit/status', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        const d = await r.json() as { connected?: boolean; error?: string };
        if (d.error) throw new Error(d.error);
        return d;
      })
      .then((d) => setFitConnected(d.connected === true))
      .catch((error) => {
        console.error('Google Fit status check failed:', error);
        setFitConnected(false);
      });
  }, [user?.id, searchParams]);

  useEffect(() => {
    const fit = searchParams.get('fit');
    const err = searchParams.get('fit_error');
    if (fit === 'connected') {
      let cancelled = false;
      void (async () => {
        try {
          const r = await fetch('/api/auth/google-fit/status', { credentials: 'same-origin' });
          if (!r.ok) throw new Error(`Status ${r.status}`);
          const d = (await r.json()) as { connected?: boolean; error?: string };
          if (cancelled) return;
          setFitConnected(d.connected === true);
          if (d.connected) {
            setFitOAuthMessage('Google Fit connected successfully.');
          } else {
            // Don't show error message for successful OAuth but no connection yet
            // This can happen due to timing issues
            setFitOAuthMessage(null);
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Google Fit verification failed:', error);
            setFitConnected(false);
            setFitOAuthMessage(t('settings.fitOAuthFail'));
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

  const generateWorkoutPlanForProfile = async (sourceProfile: any, days: string[]) => {
    if (!geminiApiKey) throw new Error('missing_gemini_key');
    if (days.length === 0) throw new Error('missing_days');
    const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
    const prompt = buildWorkoutAgendaPrompt({
      goal: sourceProfile.goal,
      selectedDays: days,
      durationHours: Number(sourceProfile.workout_duration) || 1,
      cardioPreference: sourceProfile.cardio_preference || 'run',
    });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ text: prompt }],
    });
    const raw = (result.text || '').replace(/```json|```/g, '').trim();
    return JSON.parse(raw) as Record<string, { type?: string; activity?: string; details?: unknown }>;
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (!geminiApiKey) return alert(t('settings.aiKeyMissing'));
    if (selectedDays.length === 0) return alert(t('settings.selectGymDays'));

    try {
      const nextPlan = mergeWorkoutPlanWithGymSelection(selectedDays, localProfile.workout_plan);
      const nextProfile = { ...localProfile, workout_plan: nextPlan };

      const { data: savedProfileRows, error: profileError } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, ...nextProfile })
        .select('*')
        .limit(1);
      if (profileError) throw profileError;
      const savedProfile = savedProfileRows?.[0] || nextProfile;

      const goals = await generateNutritionTargetsWithGemini(geminiApiKey, savedProfile);
      const { error: goalsDeleteError } = await supabase.from('daily_goals').delete().eq('user_id', user.id);
      if (goalsDeleteError) throw goalsDeleteError;
      const { error: goalsInsertError } = await supabase
        .from('daily_goals')
        .insert({ user_id: user.id, ...goals });
      if (goalsInsertError) throw goalsInsertError;

      const generatedPlan = await generateWorkoutPlanForProfile(savedProfile, selectedDays);
      const finalProfile = { ...savedProfile, workout_plan: generatedPlan };
      const { error: finalProfileError } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, ...finalProfile })
        .select('user_id')
        .limit(1);
      if (finalProfileError) throw finalProfileError;

      setLocalProfile(finalProfile);
      setSelectedDays(gymDaysFromPlan(generatedPlan));
      await refetchUserData();
      alert(t('settings.saved'));
    } catch (error) {
      console.error(error);
      alert(t('settings.genFailed'));
    }
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
    if (!user?.id) return;
    if (!geminiApiKey) return alert(t('settings.aiKeyMissing'));
    setGeneratingDiet(true);
    try {
      const goals = await generateNutritionTargetsWithGemini(geminiApiKey, localProfile);
      const { error: goalsDeleteError } = await supabase.from('daily_goals').delete().eq('user_id', user.id);
      if (goalsDeleteError) throw goalsDeleteError;
      const { error: goalsInsertError } = await supabase
        .from('daily_goals')
        .insert({ user_id: user.id, ...goals });
      if (goalsInsertError) throw goalsInsertError;
      await refetchUserData();
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
      const plan = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, { type?: string; activity?: string; details?: unknown }>;
      const merged = { ...localProfile, workout_plan: plan };
      await updateProfile(merged);
      setLocalProfile(merged);
      setSelectedDays(gymDaysFromPlan(plan));
      await refetchUserData();
      alert(t('settings.workoutUpdated'));
    } catch (e) {
      alert(t('settings.genFailed'));
    }
    finally { setGeneratingWorkout(false); }
  };

  const handleAvatarUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    if (!user?.id) return;
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('Avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        // Handle specific RLS policy violation
        if (uploadError.message?.includes('row-level security policy')) {
          throw new Error('Storage permission denied. Please check Supabase Storage RLS policies for the Avatars bucket.');
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from('Avatars').getPublicUrl(filePath);
      const avatarUrl = data.publicUrl;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      const nextProfile = { ...localProfile, avatar_url: avatarUrl };
      setLocalProfile(nextProfile);
      await refetchUserData();
    } catch (error) {
      console.error('Avatar upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      alert(errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const setNotificationFlag = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    saveNotificationPrefs(user?.id, next);
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('This browser does not support notifications.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        alert('Notifications are blocked. Enable them in your browser settings.');
      }
    } catch {
      alert('Could not request notification permission.');
    }
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
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="text-[10px] text-muted uppercase font-bold block mb-2">
            Profile photo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
            className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
          />
          <p className="text-[10px] text-muted mt-2">
            {uploadingAvatar ? 'Uploading...' : 'Upload an image to update your avatar.'}
          </p>
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
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-fuchsia-400">
          <Bell size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{t('settings.notifications')}</h2>
        </div>
        <p className="text-xs text-muted mb-4 leading-relaxed">{t('settings.notificationsBlurb')}</p>
        <div className="space-y-2">
          {(
            [
              ['enabled', t('settings.notifEnabled')],
              ['mealReminders', t('settings.notifMeals')],
              ['workoutReminder', t('settings.notifWorkout')],
              ['cardioReminder', t('settings.notifCardio')],
              ['weeklySummary', t('settings.notifWeekly')],
            ] as [keyof NotificationPrefs, string][]
          ).map(([key, label]) => {
            const on = notificationPrefs[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setNotificationFlag(key, !on)}
                className={`w-full rounded-xl border px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                  on
                    ? 'bg-fuchsia-500/15 border-fuchsia-500/35 text-fuchsia-200'
                    : 'bg-white/5 border-white/10 text-muted'
                }`}
              >
                <span>{label}</span>
                <span className="text-[11px] uppercase font-bold tracking-wider">{on ? t('settings.on') : t('settings.off')}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-4 w-full btn-secondary py-2.5 text-sm"
          onClick={() => void requestNotificationPermission()}
        >
          {t('settings.allowBrowserNotifications')}
        </button>
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
