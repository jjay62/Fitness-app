'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useRouter } from 'next/navigation';
import { Activity, Flame, Droplet, Wheat, Dumbbell, Loader2, Sparkles, ChevronRight, Trash2, RefreshCw, Zap, CalendarDays, Leaf } from 'lucide-react';
import { gsap } from 'gsap';
import { motion } from 'framer-motion';
import Link from 'next/link';
import UserNav from '../components/UserNav';
import { ProfileDataError } from '../components/ProfileDataError';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../lib/supabase';
import {
  isGymType,
  estimateWorkoutPlanKcalBurn,
  formatPlanDetailText,
  agendaMetAppliesForPlanBurn,
} from '../utils/workoutPlan';
import {
  AMSTERDAM_TZ,
  addAmsterdamDays,
  getAmsterdamYmd,
  startOfAmsterdamDay,
  startOfNextAmsterdamDay,
} from '../utils/amsterdamTime';

const CircularProgress = ({
  value,
  max,
  color,
  label,
  icon,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  icon: React.ReactNode;
  sublabel?: string;
}) => {
  const percentage = Math.min((value / max) * 100, 100) || 0;
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (circleRef.current) {
      gsap.fromTo(circleRef.current,
        { strokeDashoffset: circumference },
        { strokeDashoffset: offset, duration: 1.5, ease: "power3.out", delay: 0.2 }
      );
    }
  }, [offset, circumference]);

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="relative w-[72px] h-[72px] sm:w-20 sm:h-20">
        <svg width="72" height="72" viewBox="0 0 80 80" className="-rotate-90 w-full h-full">
          <circle cx="40" cy="40" r={radius} stroke="var(--glass-border)" strokeWidth="6" fill="none" />
          <circle
            ref={circleRef}
            cx="40" cy="40" r={radius}
            stroke={color}
            strokeWidth="6" fill="none"
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          {icon}
        </div>
      </div>
      <div className="text-center w-full max-w-[92px]">
        <p className="m-0 text-[11px] sm:text-xs font-semibold truncate">{value} / {max}</p>
        <p className="m-0 text-[10px] text-muted truncate">{label}</p>
        {sublabel ? (
          <p className="m-0 mt-0.5 text-[9px] text-muted leading-tight">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function weekdayFromYmd(ymd: string): string {
  return startOfAmsterdamDay(ymd).toLocaleDateString('en-US', {
    timeZone: AMSTERDAM_TZ,
    weekday: 'long',
  });
}

function weekYmdsFromAnchor(ymd: string): string[] {
  const weekday = weekdayFromYmd(ymd);
  const idx = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  const monday = addAmsterdamDays(ymd, idx >= 0 ? -idx : 0);
  return WEEKDAYS.map((_, i) => addAmsterdamDays(monday, i));
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const {
    profile,
    dailyGoals,
    dailyLogs,
    steps,
    dataLoading,
    profileFetchError,
    refetchUserData,
    removeFoodFromLog,
    agendaCompletions,
  } = useApp();
  const { locale, t } = useLocale();
  const [stepsRefreshing, setStepsRefreshing] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState(getAmsterdamYmd());
  const [selectedLogs, setSelectedLogs] = useState(dailyLogs);
  const [selectedSteps, setSelectedSteps] = useState(steps);
  const [selectedDateLoading, setSelectedDateLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [weekKcalByYmd, setWeekKcalByYmd] = useState<Record<string, number>>({});
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  useEffect(() => {
    const todayYmd = getAmsterdamYmd();
    if (selectedYmd === todayYmd) {
      setSelectedLogs(dailyLogs);
      setSelectedSteps(steps);
      return;
    }
    if (!user?.id) return;

    let cancelled = false;
    const loadForSelectedDate = async () => {
      setSelectedDateLoading(true);
      try {
        const start = startOfAmsterdamDay(selectedYmd);
        const end = startOfNextAmsterdamDay(selectedYmd);
        const [{ data: logs }, stepsRes] = await Promise.all([
          supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', user.id)
            .gte('logged_date', start.toISOString())
            .lt('logged_date', end.toISOString()),
          fetch(
            `/api/steps?date=${selectedYmd}&startMs=${start.getTime()}&endMs=${end.getTime()}`,
            { credentials: 'same-origin' }
          ),
        ]);
        const stepsData = (await stepsRes.json()) as { steps?: number };
        if (cancelled) return;
        setSelectedLogs((logs ?? []) as typeof dailyLogs);
        setSelectedSteps(typeof stepsData.steps === 'number' ? stepsData.steps : 0);
      } catch {
        if (!cancelled) {
          setSelectedLogs([]);
          setSelectedSteps(0);
        }
      } finally {
        if (!cancelled) setSelectedDateLoading(false);
      }
    };

    void loadForSelectedDate();
    return () => {
      cancelled = true;
    };
  }, [selectedYmd, user?.id, dailyLogs, steps]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadWeekKcal = async () => {
      const ymds = weekYmdsFromAnchor(selectedYmd);
      const start = startOfAmsterdamDay(ymds[0]);
      const end = startOfNextAmsterdamDay(ymds[6]);
      const { data } = await supabase
        .from('daily_logs')
        .select('kcal, logged_date')
        .eq('user_id', user.id)
        .gte('logged_date', start.toISOString())
        .lt('logged_date', end.toISOString());
      if (cancelled) return;
      const byYmd: Record<string, number> = {};
      for (const y of ymds) byYmd[y] = 0;
      for (const row of data ?? []) {
        const raw = typeof row.logged_date === 'string' ? row.logged_date : '';
        if (!raw) continue;
        const ymd = new Date(raw).toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ });
        byYmd[ymd] = (byYmd[ymd] || 0) + (Number(row.kcal) || 0);
      }
      setWeekKcalByYmd(byYmd);
    };
    void loadWeekKcal();
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedYmd]);

  const burnDerived = useMemo(() => {
    const selectedWeekday = weekdayFromYmd(selectedYmd);
    const entry = profile?.workout_plan?.[selectedWeekday];
    const wKg = Number(profile?.weight) || 70;
    const sHrs = Number(profile?.workout_duration) || 1;
    const completionState = agendaCompletions[selectedYmd];
    const completed = completionState === 'done';
    const skipped = completionState === 'skipped';
    const est = estimateWorkoutPlanKcalBurn(entry, wKg, sHrs);
    const metApplies = agendaMetAppliesForPlanBurn(profile?.cardio_preference, entry);
    const planKcalBurned = completed && metApplies ? est : 0;
    return {
      planKcalBurned,
      planSkipped: skipped,
      planCompleted: completed,
      stepsOnlyCardio: completed && !metApplies,
      todayPlanEntry: entry,
    };
  }, [
    selectedYmd,
    agendaCompletions,
    profile?.workout_plan,
    profile?.weight,
    profile?.workout_duration,
    profile?.cardio_preference,
  ]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!user) {
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

  if (dataLoading || !profile.is_setup_complete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const totalKcal = selectedLogs.reduce((acc, log) => acc + (Number(log.kcal) || 0), 0);
  const totalProtein = selectedLogs.reduce((acc, log) => acc + (Number(log.protein) || 0), 0);
  const totalCarbs = selectedLogs.reduce((acc, log) => acc + (Number(log.carbs) || 0), 0);
  const totalFats = selectedLogs.reduce((acc, log) => acc + (Number(log.fats) || 0), 0);
  const totalFiber = selectedLogs.reduce((acc, log) => acc + (Number(log.fiber) || 0), 0);

  const stepsKcalBurned = Math.floor(selectedSteps * 0.04);

  const { planKcalBurned, planSkipped, planCompleted, stepsOnlyCardio, todayPlanEntry } = burnDerived;
  const selectedIsGym = isGymType(todayPlanEntry?.type);
  const selectedDateLabel = startOfAmsterdamDay(selectedYmd).toLocaleDateString(
    locale === 'nl' ? 'nl-NL' : 'en-US',
    { timeZone: AMSTERDAM_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  );
  const weekRows = weekYmdsFromAnchor(selectedYmd).map((ymd) => {
    const weekday = weekdayFromYmd(ymd);
    const dayType = profile?.workout_plan?.[weekday]?.type || t('dashboard.rest');
    const kcal = Math.round(weekKcalByYmd[ymd] || 0);
    const goal = dailyGoals.kcal || 1;
    return { ymd, weekday, dayType, kcal, goal, pct: Math.max(0, Math.min(100, (kcal / goal) * 100)) };
  });
  const totalBurnedKcal = stepsKcalBurned + planKcalBurned;
  const burnGoalMax = Math.min(900, Math.max(300, Math.round(dailyGoals.kcal * 0.25)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto w-full px-4 sm:px-0 space-y-6 pb-24"
    >
      <UserNav />

      <header className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:items-center text-foreground">
        <div className="min-w-0">
          <h1 className="page-title text-3xl sm:text-4xl">{t('dashboard.title')}</h1>
          <p className="text-muted text-sm">
            {t('dashboard.welcome', { name: profile?.username || t('dashboard.legend') })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDatePickerOpen(true)}
          className="w-full sm:w-auto bg-white/5 border border-white/10 px-3 py-2 rounded-full dark:bg-white/5 text-sm text-blue-400 font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          title={t('dashboard.selectDate')}
        >
          <CalendarDays size={15} className="shrink-0" />
          <span className="truncate">{selectedDateLabel}</span>
        </button>
      </header>

      {profile?.workout_plan && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent p-5"
        >
          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={18} className="text-blue-400" />
              <span className="truncate">{t('dashboard.dayAgenda')}</span>
            </div>
            <Link 
              href="/agenda" 
              className="text-[10px] text-muted hover:text-foreground flex items-center gap-0.5 transition-colors group"
            >
              {t('dashboard.seeFullWeek')}
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="flex justify-between items-start mb-3 gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-muted uppercase tracking-tighter">{t('dashboard.currentRoutine')}</h2>
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                selectedIsGym ? 'bg-blue-500 text-white' : 'bg-white/10 text-muted'
              }`}
            >
              {selectedIsGym ? t('dashboard.gym') : todayPlanEntry?.type || t('dashboard.rest')}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
               {selectedIsGym ? <Dumbbell className="text-blue-400" /> : <Flame className="text-amber-400" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-base sm:text-lg leading-tight break-words">
                {formatPlanDetailText(todayPlanEntry?.activity) || t('dashboard.restDay')}
              </p>
              <p className="text-xs text-muted mt-1 italic line-clamp-3 break-words">
                {formatPlanDetailText(todayPlanEntry?.details) || t('dashboard.recoveryHint')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="glass-panel">
        <h2 className="text-xl font-semibold mb-4">{t('dashboard.dailyGoals')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-6 gap-x-2 place-items-center">
          <CircularProgress
            value={totalKcal}
            max={dailyGoals.kcal}
            color="#3b82f6"
            label={t('dashboard.kcalIn')}
            icon={<Flame size={20} />}
          />
          <CircularProgress
            value={totalBurnedKcal}
            max={burnGoalMax}
            color="#f97316"
            label={t('dashboard.burned')}
            icon={<Zap size={20} />}
            sublabel={
              planSkipped
                ? t('dashboard.subStepsOnly')
                : !planCompleted
                  ? t('dashboard.subStepsOnly')
                  : stepsOnlyCardio
                  ? t('dashboard.subStepsCardio')
                  : t('dashboard.subStepsPlan')
            }
          />
          <CircularProgress
            value={totalProtein}
            max={dailyGoals.protein}
            color="#8b5cf6"
            label={t('dashboard.protein')}
            icon={<Dumbbell size={20} />}
          />
          <CircularProgress
            value={totalCarbs}
            max={dailyGoals.carbs}
            color="#f59e0b"
            label={t('dashboard.carbs')}
            icon={<Wheat size={20} />}
          />
          <CircularProgress
            value={totalFats}
            max={dailyGoals.fats}
            color="#ef4444"
            label={t('dashboard.fats')}
            icon={<Droplet size={20} />}
          />
          <CircularProgress
            value={totalFiber}
            max={dailyGoals.fiber}
            color="#22c55e"
            label={t('dashboard.fiber')}
            icon={<Leaf size={20} />}
          />
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-emerald-400">
              <Activity size={20} /> {t('dashboard.activity')}
            </h3>
            <p className="text-2xl sm:text-3xl font-bold my-2">{selectedSteps.toLocaleString()}</p>
            <p className="text-sm text-muted">{t('dashboard.stepsForDate')}</p>
          </div>
          <button
            type="button"
            title={t('dashboard.refreshSteps')}
            disabled={stepsRefreshing}
            onClick={async () => {
              setStepsRefreshing(true);
              try {
                const start = startOfAmsterdamDay(selectedYmd);
                const end = startOfNextAmsterdamDay(selectedYmd);
                const res = await fetch(
                  `/api/steps?date=${selectedYmd}&startMs=${start.getTime()}&endMs=${end.getTime()}`,
                  { credentials: 'same-origin' }
                );
                const data = (await res.json()) as { steps?: number };
                if (res.ok && typeof data.steps === 'number') setSelectedSteps(data.steps);
              } finally {
                setStepsRefreshing(false);
              }
            }}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-emerald-400 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={18} className={stepsRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <h3 className="text-lg font-semibold border-b border-[color:var(--glass-border)] pb-2 mb-3">
          {t('dashboard.recentMeals')}
        </h3>
        {selectedDateLoading ? (
          <p className="text-sm text-muted">{t('dashboard.loadingDate')}</p>
        ) : selectedLogs.length === 0 ? (
          <p className="text-sm text-muted">{t('dashboard.noMeals')}</p>
        ) : (
          <ul className="space-y-3">
            {selectedLogs.map((log, i) => (
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={log.id || i}
                className="flex justify-between items-center gap-2 pb-3 border-b border-[color:var(--glass-border)] last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                <span className="block font-medium truncate">{log.name}</span>
                  <span className="text-xs text-gray-400">{log.category}</span>
                </div>
                <span className="font-semibold text-blue-400 shrink-0 text-xs sm:text-sm">{log.kcal} kcal</span>
                <button
                  type="button"
                  title={t('dashboard.removeMeal')}
                  disabled={!log.id}
                  onClick={() => log.id && void removeFoodFromLog(log.id)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-panel">
        <h3 className="text-lg font-semibold border-b border-[color:var(--glass-border)] pb-2 mb-3">
          {t('dashboard.thisWeek')}
        </h3>
        <div className="space-y-2">
          {weekRows.map((row) => (
            <div key={row.ymd} className="rounded-xl border border-[color:var(--glass-border)] p-3 bg-white/5">
              <div className="flex items-center justify-between text-sm mb-2 gap-2">
                <span className="font-semibold truncate">{row.weekday}</span>
                <span className="text-xs text-muted uppercase shrink-0">{row.dayType}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <span>{row.kcal.toFixed(0)} kcal</span>
                <span>/ {row.goal} kcal</span>
              </div>
              <div className="h-2 rounded-full bg-black/25 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {datePickerOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDatePickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0f1419] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{t('dashboard.selectDate')}</h3>
            <input
              type="date"
              value={selectedYmd}
              onChange={(e) => {
                setSelectedYmd(e.target.value || getAmsterdamYmd());
                setDatePickerOpen(false);
              }}
              className="w-full input-field bg-white/5 border-white/15"
            />
            <button
              type="button"
              onClick={() => setDatePickerOpen(false)}
              className="w-full py-2 rounded-xl border border-white/15 bg-white/5 text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
