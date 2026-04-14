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
import { ProfileDataError } from '../../components/ProfileDataError';
import { WEEKDAYS, gymDaysFromPlan, mergeWorkoutPlanWithGymSelection } from '../../utils/workoutPlan';

const CARDIO_OPTIONS = [
  { id: 'run', name: 'Running', icon: '🏃' },
  { id: 'walk', name: 'Walking', icon: '🚶' },
  { id: 'cycle', name: 'Cycling', icon: '🚴' },
  { id: 'swim', name: 'Swimming', icon: '🏊' },
  { id: 'stairmaster', name: 'Stairmaster', icon: '🪜' },
  { id: 'crossfit', name: 'CrossFit', icon: '🏋️' }
];

function SettingsContent() {
  const { user, loading: authLoading } = useAuth();
  const { geminiApiKey, profile, updateProfile, updateProfileAndGoals, dataLoading, profileFetchError, refetchUserData } = useApp();
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
          setFitOAuthMessage(
            d.connected ? 'Google Fit connected.' : 'Could not verify Google Fit. Try connecting again.'
          );
        } catch {
          if (!cancelled) {
            setFitConnected(false);
            setFitOAuthMessage('Could not verify Google Fit. Try connecting again.');
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
      setFitOAuthMessage('Could not connect. Try again.');
      router.replace('/settings');
    }
  }, [searchParams, router]);

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
    alert('Profile saved successfully!');
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
    if (!geminiApiKey) return alert("AI Key missing.");
    setGeneratingDiet(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
      const prompt = `
        Act as a PhD-level Sports Nutritionist. Calculate precise daily nutritional targets.
        Profile: ${localProfile.gender}, ${localProfile.age}y/o, ${localProfile.height}cm, ${localProfile.weight}kg, ${localProfile.body_fat_percentage}% fat. Goal: ${localProfile.goal}.
        Rules: Mifflin-St Jeor, 1.55x Activity, 2.2g Protein/kg.
        Output MUST be pure JSON: {"kcal": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0}
      `;
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: [{ text: prompt }] });
      const text = result.text || '';
      const goals = JSON.parse(text.replace(/```json|```/g, '').trim());
      await updateProfileAndGoals(localProfile, goals);
      alert("Diet Plan Updated!");
    } catch (e) { alert("Generation failed."); }
    finally { setGeneratingDiet(false); }
  };

  const generateWorkoutPlan = async () => {
    if (!geminiApiKey) return alert("AI Key missing.");
    if (selectedDays.length === 0) return alert("Select gym days first.");
    setGeneratingWorkout(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
      const prompt = `
        Coach Mode: Create a 7-day Agenda. 
        Goal: ${localProfile.goal}. Gym Days: ${selectedDays.join(', ')}. Cardio: ${localProfile.cardio_preference || 'run'}.
        JSON: {"Monday": {"type": "Gym/Cardio/Rest", "activity": "", "details": ""}, ...}
      `;
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: [{ text: prompt }] });
      const text = result.text || '';
      const plan = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, { type?: string; activity?: string; details?: string }>;
      const merged = { ...localProfile, workout_plan: plan };
      await updateProfile(merged);
      setLocalProfile(merged);
      setSelectedDays(gymDaysFromPlan(plan));
      alert('Workout Agenda Updated!');
    } catch (e) { alert("Generation failed."); }
    finally { setGeneratingWorkout(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <UserNav />
      <header className="flex justify-between items-center">
        <h1 className="page-title flex items-center gap-2 text-3xl"><SettingsIcon /> Settings</h1>
        <button className="btn-primary py-2 px-6 rounded-full text-sm" onClick={handleSaveProfile}>Save Changes</button>
      </header>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-blue-400">
          <UserIcon size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Biometrics</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Gender</label>
            <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
              {['male', 'female'].map(g => (
                <button key={g} onClick={() => setLocalProfile({...localProfile, gender: g})} className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${localProfile.gender === g ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4">Age: {localProfile.age} y/o</label>
            <input type="range" min="13" max="100" value={localProfile.age || 25} onChange={e => setLocalProfile({...localProfile, age: e.target.value})} className="w-full custom-slider slider-amber" />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4">Weight: {localProfile.weight} kg</label>
            <input type="range" min="40" max="150" step="0.5" value={localProfile.weight || 70} onChange={e => setLocalProfile({...localProfile, weight: e.target.value})} className="w-full custom-slider slider-emerald" />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4">Height: {localProfile.height} cm</label>
            <input type="range" min="130" max="230" value={localProfile.height || 175} onChange={e => setLocalProfile({...localProfile, height: e.target.value})} className="w-full custom-slider slider-blue" />
          </div>
          <div className="col-span-2 pt-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4">Body Fat: {localProfile.body_fat_percentage}%</label>
            <input type="range" min="3" max="50" step="0.5" value={localProfile.body_fat_percentage || 15} onChange={e => setLocalProfile({...localProfile, body_fat_percentage: parseFloat(e.target.value)})} className="w-full custom-slider slider-violet" />
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-cyan-400">
          <Link2 size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Google Fit & steps</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Sync step count from your Google account.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <a href="/api/auth/google-fit/start" className="btn-primary py-2 px-4 rounded-full text-sm inline-block text-center">
            Connect Google Fit
          </a>
          {fitConnected === true && (
            <span className="text-xs font-semibold text-emerald-400">Connected</span>
          )}
          {fitConnected === false && (
            <span className="text-xs text-gray-500">Not connected</span>
          )}
        </div>
        {fitOAuthMessage && (
          <p className="text-xs text-amber-200/90 mb-4 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/10">
            {fitOAuthMessage}
            <button
              type="button"
              className="ml-2 text-gray-400 hover:text-white underline text-[10px]"
              onClick={() => setFitOAuthMessage(null)}
            >
              Dismiss
            </button>
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold">Height for steps (meters, optional)</label>
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
          <h2 className="text-lg font-bold uppercase tracking-wider">Training & Agenda</h2>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4 text-blue-400">Frequency: {localProfile.workout_frequency || 4} days/week</label>
              <input type="range" min="1" max="7" value={localProfile.workout_frequency || 4} onChange={e => setLocalProfile({...localProfile, workout_frequency: parseInt(e.target.value)})} className="w-full custom-slider slider-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4 text-emerald-400">Session Time: {localProfile.workout_duration || 1} hrs</label>
              <input type="range" min="0.5" max="3" step="0.5" value={localProfile.workout_duration || 1} onChange={e => setLocalProfile({...localProfile, workout_duration: parseFloat(e.target.value)})} className="w-full custom-slider slider-emerald" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4 italic">Pick your Gym Days (Max: {localProfile.workout_frequency || 4})</label>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map((day) => (
                <button key={day} onClick={() => toggleDay(day)} className={`p-2 text-[10px] font-bold rounded-lg border transition-all ${selectedDays.includes(day) ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-gray-500'}`}>{day.substring(0, 3)}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-4">Cardio Preference</label>
            <div className="grid grid-cols-3 gap-2">
              {CARDIO_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setLocalProfile({...localProfile, cardio_preference: opt.id})} className={`p-3 rounded-xl border flex flex-col items-center transition-all ${localProfile.cardio_preference === opt.id ? 'bg-violet-500/20 border-violet-500' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                  <span className="text-xl mb-1">{opt.icon}</span>
                  <span className="text-[9px] font-bold uppercase">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10" onClick={generateWorkoutPlan} disabled={generatingWorkout}>
            {generatingWorkout ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} /> Regenerate AI Workout Agenda</>}
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6 text-amber-400">
          <Activity size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Nutrition & Goals</h2>
        </div>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Main Goal</label>
            <select className="input-field appearance-none bg-white/5 border-white/10" value={localProfile.goal || 'maintain'} onChange={e => setLocalProfile({ ...localProfile, goal: e.target.value })}>
              <option value="lose">Lose Weight</option>
              <option value="maintain">Maintain Weight</option>
              <option value="gain">Bulk Up</option>
              <option value="lose_gain">Lose & Gain (Recomp)</option>
            </select>
          </div>
          <button className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-amber-400 border-amber-500/20 hover:bg-amber-500/10" onClick={generateDietPlan} disabled={generatingDiet}>
            {generatingDiet ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} /> Update AI Nutritional Targets</>}
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
