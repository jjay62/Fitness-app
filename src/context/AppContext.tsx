'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  addAmsterdamDays,
  getAmsterdamYmd,
  msUntilNextAmsterdamMidnight,
  startOfAmsterdamDay,
  startOfNextAmsterdamDay,
  getAmsterdamDayMsRange,
} from '../utils/amsterdamTime';


export interface Profile {
  height: string;
  weight: string;
  age: string;
  gender: string;
  goal: string;
  body_fat_percentage?: number;
  workout_plan?: any;
  workout_frequency?: number;
  workout_duration?: number;
  cardio_preference?: string;
  is_setup_complete?: boolean;
  username?: string;
  avatar_url?: string;
  height_m?: number | null;
}

interface DailyGoals {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
}

export interface FoodItem {
  id?: string;
  name: string;
  category?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  logged_date?: string;
}

export interface WeightEntry {
  id: string;
  weight_kg: number;
  logged_at: string;
}

interface AppContextType {
  geminiApiKey: string;
  saveGeminiKey: (key: string) => void;
  profile: Profile;
  updateProfileAndGoals: (newProfile: Profile, newGoals: DailyGoals) => void;
  dailyGoals: DailyGoals;
  foodLibrary: FoodItem[];
  addFoodToLibrary: (foodItem: FoodItem) => void;
  updateFoodLibraryItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  deleteFoodLibraryItem: (id: string) => Promise<void>;
  dailyLogs: FoodItem[];
  addFoodToLog: (foodItem: FoodItem) => void;
  removeFoodFromLog: (id: string) => Promise<void>;
  recentMealLogs7d: FoodItem[];
  weightEntries: WeightEntry[];
  addWeightEntry: (weightKg: number) => Promise<void>;
  steps: number;
  refreshFitSteps: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  dataLoading: boolean;
  profileFetchError: string | null;
  refetchUserData: () => Promise<void>;
}

const EMPTY_PROFILE: Profile = {
  height: '',
  weight: '',
  age: '',
  gender: 'male',
  goal: 'maintain',
  is_setup_complete: false,
};

function coerceSetupComplete(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'yes';
  }
  return false;
}

/** Prefer the row that reflects finished setup when duplicates exist (e.g. upsert without UNIQUE(user_id)). */
function selectBestProfileRow(rows: Record<string, unknown>[]): Record<string, unknown> | undefined {
  if (!rows.length) return undefined;
  const score = (r: Record<string, unknown>) => {
    let s = 0;
    if (coerceSetupComplete(r.is_setup_complete)) s += 1000;
    const wp = r.workout_plan;
    if (wp != null && (typeof wp === 'object' || (typeof wp === 'string' && (wp as string).length > 2))) s += 200;
    if (r.height && r.weight) s += 50;
    if (r.body_fat_percentage != null) s += 10;
    return s;
  };
  const ts = (r: Record<string, unknown>) =>
    String(r.updated_at ?? r.created_at ?? r.inserted_at ?? '');
  return [...rows].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return ts(b).localeCompare(ts(a));
  })[0];
}

function parseWorkoutPlan(raw: unknown): Profile['workout_plan'] {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return typeof p === 'object' && p !== null ? p : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object') return raw as Profile['workout_plan'];
  return undefined;
}

function normalizeProfileFromRow(row: Record<string, unknown> & { gemini_api_key?: string }): Profile & { gemini_api_key?: string } {
  const { strava_access_token: _s, google_fit_refresh_token: _g, ...safe } = row as Record<string, unknown>;
  const merged = { ...EMPTY_PROFILE, ...safe } as Profile & { gemini_api_key?: string };
  merged.is_setup_complete = coerceSetupComplete(row.is_setup_complete);
  merged.workout_plan = parseWorkoutPlan(row.workout_plan);
  return merged;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [dailyGoals, setDailyGoals] = useState<DailyGoals>({ kcal: 2000, protein: 150, carbs: 200, fats: 65, fiber: 30 });
  const [foodLibrary, setFoodLibrary] = useState<FoodItem[]>([]);
  const [dailyLogs, setDailyLogs] = useState<FoodItem[]>([]);
  const [recentMealLogs7d, setRecentMealLogs7d] = useState<FoodItem[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [steps, setSteps] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);

  const fetchProfileForUser = async (uid: string) => {
    let { data, error } = await supabase.from('profiles').select('*').eq('user_id', uid).limit(50);
    if (error) {
      await new Promise((r) => setTimeout(r, 400));
      const second = await supabase.from('profiles').select('*').eq('user_id', uid).limit(50);
      data = second.data;
      error = second.error;
    }
    if (error) {
      console.error('Profile fetch error:', error.message);
      setProfileFetchError(error.message);
      return;
    }
    setProfileFetchError(null);
    const rows = (data ?? []) as Record<string, unknown>[];
    const picked = selectBestProfileRow(rows);
    if (picked) {
      const normalized = normalizeProfileFromRow(picked as Record<string, unknown> & { gemini_api_key?: string });
      setProfile(normalized);
      if (normalized.gemini_api_key) setGeminiApiKey(normalized.gemini_api_key);
    } else {
      setProfile(EMPTY_PROFILE);
    }
  };

  const fetchDailyGoalsForUser = async (uid: string) => {
    const { data, error } = await supabase
      .from('daily_goals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.warn('Daily goals fetch:', error.message);
      return;
    }
    const row = data?.[0];
    if (row) setDailyGoals(row as DailyGoals);
  };

  const fetchFoodLibraryForUser = async (uid: string) => {
    const { data } = await supabase.from('food_library').select('*').eq('user_id', uid);
    if (data) setFoodLibrary(data as FoodItem[]);
  };

  const fetchDailyLogsForUser = async (uid: string) => {
    const ymd = getAmsterdamYmd();
    const start = startOfAmsterdamDay(ymd);
    const end = startOfNextAmsterdamDay(ymd);
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .gte('logged_date', start.toISOString())
      .lt('logged_date', end.toISOString());
    if (data) setDailyLogs(data as FoodItem[]);
  };

  const fetchRecentMealLogs7dForUser = async (uid: string) => {
    const sinceYmd = addAmsterdamDays(getAmsterdamYmd(), -7);
    const since = startOfAmsterdamDay(sinceYmd);
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .gte('logged_date', since.toISOString());
    if (error) {
      console.warn('Recent logs fetch:', error.message);
      setRecentMealLogs7d([]);
      return;
    }
    setRecentMealLogs7d((data ?? []) as FoodItem[]);
  };

  const fetchWeightEntriesForUser = async (uid: string) => {
    const { data, error } = await supabase
      .from('weight_entries')
      .select('id, weight_kg, logged_at')
      .eq('user_id', uid)
      .order('logged_at', { ascending: true });
    if (error) {
      console.warn('weight_entries (create table + RLS if missing):', error.message);
      setWeightEntries([]);
      return;
    }
    setWeightEntries((data ?? []) as WeightEntry[]);
  };

  const loadUserData = useCallback(
    async (opts?: { resetProfile?: boolean }) => {
      const uid = user?.id;
      if (!uid) return;
      if (opts?.resetProfile) {
        setProfile(EMPTY_PROFILE);
      }
      setProfileFetchError(null);
      setDataLoading(true);
      try {
        await Promise.all([
          fetchProfileForUser(uid),
          fetchDailyGoalsForUser(uid),
          fetchFoodLibraryForUser(uid),
          fetchDailyLogsForUser(uid),
          fetchRecentMealLogs7dForUser(uid),
          fetchWeightEntriesForUser(uid),
        ]);
      } catch (error) {
        console.error('Initial fetch error:', error);
      } finally {
        setDataLoading(false);
      }
    },
    [user?.id]
  );

  const refetchUserData = useCallback(async () => {
    await loadUserData({ resetProfile: false });
  }, [loadUserData]);

  useEffect(() => {
    const key = localStorage.getItem('geminiApiKey');
    if (key) setGeminiApiKey(key);
    else if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) setGeminiApiKey(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  }, []);

  useEffect(() => {
    if (!userId) {
      if (!authLoading) {
        setDataLoading(false);
        setProfile(EMPTY_PROFILE);
        setProfileFetchError(null);
        setWeightEntries([]);
        setRecentMealLogs7d([]);
      }
      return;
    }
    if (authLoading) return;
    loadUserData({ resetProfile: true });
  }, [userId, authLoading, loadUserData]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!userId) return;
    const merged = { ...profile, ...updates };
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...merged });
    if (error) {
      console.error('Profile Upsert Error:', error);
      alert('Failed to save profile changes to database. Please check your Supabase schema.');
      return;
    }
    const { strava_access_token: _t, google_fit_refresh_token: _g, ...withoutSecret } = merged as Record<string, unknown>;
    setProfile(withoutSecret as unknown as Profile);
  };

  const updateProfileAndGoals = async (newProfile: Profile, newGoals: DailyGoals) => {
    if (!userId) return;
    setProfile(newProfile);
    setDailyGoals(newGoals);

    const { error: pError } = await supabase.from('profiles').upsert({ user_id: userId, ...newProfile });
    const { error: gError } = await supabase.from('daily_goals').insert({ user_id: userId, ...newGoals });

    if (pError || gError) {
      console.error('Save Error:', pError || gError);
      alert('AI values generated but failed to save to database.');
    }
  };

  const addFoodToLog = async (foodItem: FoodItem) => {
    if (!userId) return;
    const newLog = {
      ...foodItem,
      user_id: userId,
      logged_date: new Date().toISOString(),
    };

    const { data } = await supabase.from('daily_logs').insert(newLog).select();
    if (data && data.length > 0) {
      const row = data[0] as FoodItem;
      setDailyLogs((prev) => [...prev, row]);
      setRecentMealLogs7d((prev) => [...prev, row]);
    } else {
      const row = { ...newLog, id: Date.now().toString() } as FoodItem;
      setDailyLogs((prev) => [...prev, row]);
      setRecentMealLogs7d((prev) => [...prev, row]);
    }
  };

  const addFoodToLibrary = async (foodItem: FoodItem) => {
    if (!userId) return;
    const newItem = { ...foodItem, user_id: userId };
    const { data } = await supabase.from('food_library').insert(newItem).select();
    if (data && data.length > 0) {
      setFoodLibrary((prev) => [...prev, data[0] as FoodItem]);
    } else {
      setFoodLibrary((prev) => [...prev, { ...newItem, id: Date.now().toString() } as FoodItem]);
    }
  };

  const updateFoodLibraryItem = async (id: string, updates: Partial<FoodItem>) => {
    if (!userId || !id) return;
    const payload = Object.fromEntries(
      Object.entries(updates).filter(
        ([k, v]) => v !== undefined && k !== 'id' && k !== 'logged_date'
      )
    ) as Record<string, unknown>;
    const { data, error } = await supabase
      .from('food_library')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select();
    if (error || !data?.length) {
      console.error('Library update:', error);
      alert('Could not update food. Check your connection and schema.');
      return;
    }
    const row = data[0] as FoodItem;
    setFoodLibrary((prev) => prev.map((it) => (it.id === id ? { ...it, ...row } : it)));
  };

  const deleteFoodLibraryItem = async (id: string) => {
    if (!userId || !id) return;
    const { error } = await supabase.from('food_library').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error(error);
      alert('Could not delete item.');
      return;
    }
    setFoodLibrary((prev) => prev.filter((it) => it.id !== id));
  };

  const removeFoodFromLog = async (id: string) => {
    if (!userId || !id) return;
    const { error } = await supabase.from('daily_logs').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error(error);
      alert('Could not remove meal.');
      return;
    }
    setDailyLogs((prev) => prev.filter((l) => l.id !== id));
    setRecentMealLogs7d((prev) => prev.filter((l) => l.id !== id));
  };

  const addWeightEntry = async (weightKg: number) => {
    if (!userId || !(weightKg > 0 && weightKg < 500)) {
      alert('Enter a valid weight in kg.');
      return;
    }
    const { data, error } = await supabase
      .from('weight_entries')
      .insert({ user_id: userId, weight_kg: weightKg })
      .select('id, weight_kg, logged_at');
    if (error) {
      console.error(error);
      alert(error.message || 'Could not save weight. Create weight_entries table in Supabase (see AppContext comment).');
      return;
    }
    if (data?.[0]) {
      const row = data[0] as WeightEntry;
      setWeightEntries((prev) =>
        [...prev, row].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
      );
    }
  };

  const refreshFitSteps = useCallback(async () => {
    if (!userId) return;
    try {
      const { ymd, startMs, endMs } = getAmsterdamDayMsRange();
      const q = new URLSearchParams({
        date: ymd,
        startMs: String(startMs),
        endMs: String(endMs),
      });
      const res = await fetch(`/api/steps?${q}`, { credentials: 'same-origin' });
      const data = (await res.json()) as { steps?: number; error?: string };
      if (!res.ok) {
        console.warn('Steps API:', data.error);
        return;
      }
      if (typeof data.steps === 'number') setSteps(data.steps);
    } catch (e) {
      console.warn('Steps fetch failed', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || authLoading || dataLoading) return;
    void refreshFitSteps();
  }, [userId, authLoading, dataLoading, refreshFitSteps]);

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => void refreshFitSteps(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [userId, refreshFitSteps]);

  const amsterdamDayRef = useRef(getAmsterdamYmd());

  useEffect(() => {
    if (!userId || authLoading) return;
    amsterdamDayRef.current = getAmsterdamYmd();

    const refetchForNewAmsterdamDay = async () => {
      const ymd = getAmsterdamYmd();
      const start = startOfAmsterdamDay(ymd);
      const end = startOfNextAmsterdamDay(ymd);
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_date', start.toISOString())
        .lt('logged_date', end.toISOString());
      setDailyLogs((data ?? []) as FoodItem[]);
      const sinceYmd = addAmsterdamDays(ymd, -7);
      const since = startOfAmsterdamDay(sinceYmd).toISOString();
      const recent = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_date', since);
      setRecentMealLogs7d((recent.data ?? []) as FoodItem[]);
      await refreshFitSteps();
    };

    const bumpIfDateChanged = () => {
      const y = getAmsterdamYmd();
      if (y !== amsterdamDayRef.current) {
        amsterdamDayRef.current = y;
        void refetchForNewAmsterdamDay();
      }
    };

    let timer: ReturnType<typeof setTimeout>;
    const armMidnightTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        bumpIfDateChanged();
        armMidnightTimer();
      }, msUntilNextAmsterdamMidnight());
    };
    armMidnightTimer();

    const onVis = () => bumpIfDateChanged();
    document.addEventListener('visibilitychange', onVis);
    const poll = window.setInterval(bumpIfDateChanged, 60_000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(poll);
    };
  }, [userId, authLoading, refreshFitSteps]);

  const saveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('geminiApiKey', key);
  };

  return (
    <AppContext.Provider
      value={{
        geminiApiKey,
        saveGeminiKey,
        profile,
        updateProfileAndGoals,
        dailyGoals,
        foodLibrary,
        addFoodToLibrary,
        updateFoodLibraryItem,
        deleteFoodLibraryItem,
        dailyLogs,
        addFoodToLog,
        removeFoodFromLog,
        recentMealLogs7d,
        weightEntries,
        addWeightEntry,
        steps,
        refreshFitSteps,
        updateProfile,
        dataLoading,
        profileFetchError,
        refetchUserData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
