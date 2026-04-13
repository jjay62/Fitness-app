'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useRouter } from 'next/navigation';
import { Activity, Flame, Droplet, Wheat, Dumbbell, Loader2, Sparkles, ChevronRight, Trash2, RefreshCw, Zap } from 'lucide-react';
import { gsap } from 'gsap';
import { motion } from 'framer-motion';
import Link from 'next/link';
import UserNav from '../components/UserNav';
import { ProfileDataError } from '../components/ProfileDataError';
import { isGymType, estimateWorkoutPlanKcalBurn, formatPlanDetailText } from '../utils/workoutPlan';
import { getAmsterdamWeekdayLong, getAmsterdamYmd } from '../utils/amsterdamTime';
import { loadAgendaCompletions } from '../lib/agendaCompletionStorage';

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
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" className="-rotate-90">
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
      <div className="text-center max-w-[88px]">
        <p className="m-0 text-xs font-semibold">{value} / {max}</p>
        <p className="m-0 text-[10px] text-gray-400">{label}</p>
        {sublabel ? (
          <p className="m-0 mt-0.5 text-[9px] text-gray-500 leading-tight">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { profile, dailyGoals, dailyLogs, steps, dataLoading, profileFetchError, refetchUserData, removeFoodFromLog, refreshFitSteps } = useApp();
  const [stepsRefreshing, setStepsRefreshing] = useState(false);
  const [agendaRev, setAgendaRev] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const bump = () => setAgendaRev((r) => r + 1);
    window.addEventListener('port62-agenda-completion', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('port62-agenda-completion', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  const burnDerived = useMemo(() => {
    const todayWeekday = getAmsterdamWeekdayLong();
    const entry = profile?.workout_plan?.[todayWeekday];
    const wKg = Number(profile?.weight) || 70;
    const sHrs = Number(profile?.workout_duration) || 1;
    const skipped = !!(user?.id && loadAgendaCompletions(user.id)[getAmsterdamYmd()] === 'skipped');
    const est = estimateWorkoutPlanKcalBurn(entry, wKg, sHrs);
    return {
      planKcalBurned: skipped ? 0 : est,
      planSkipped: skipped,
      todayWeekday,
      todayPlanEntry: entry,
      weightKg: wKg,
      sessionHours: sHrs,
    };
  }, [user?.id, profile?.workout_plan, profile?.weight, profile?.workout_duration, agendaRev]);

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

  const totalKcal = dailyLogs.reduce((acc, log) => acc + (Number(log.kcal) || 0), 0);
  const totalProtein = dailyLogs.reduce((acc, log) => acc + (Number(log.protein) || 0), 0);
  const totalCarbs = dailyLogs.reduce((acc, log) => acc + (Number(log.carbs) || 0), 0);
  const totalFats = dailyLogs.reduce((acc, log) => acc + (Number(log.fats) || 0), 0);
  const totalFiber = dailyLogs.reduce((acc, log) => acc + (Number(log.fiber) || 0), 0);

  const stepsKcalBurned = Math.floor(steps * 0.04);

  const { planKcalBurned, planSkipped, todayWeekday, todayPlanEntry, weightKg, sessionHours } = burnDerived;
  const todayIsGym = isGymType(todayPlanEntry?.type);
  const totalBurnedKcal = stepsKcalBurned + planKcalBurned;
  const burnGoalMax = Math.min(900, Math.max(300, Math.round(dailyGoals.kcal * 0.25)));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <UserNav />

      <header className="flex justify-between items-center text-white">
        <div>
          <h1 className="page-title text-4xl">Dashboard</h1>
          <p className="text-gray-400 text-sm">Welcome back, {profile?.username || 'Legend'}</p>
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full">
          <span className="text-blue-400 font-semibold text-sm">Today</span>
        </div>
      </header>

      {/* Today's Agenda Card */}
      {profile?.workout_plan && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent p-5"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-blue-400" />
              Today's Agenda
            </div>
            <Link 
              href="/agenda" 
              className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5 transition-colors group"
            >
              See Full Week
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Current Routine</h2>
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                todayIsGym ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'
              }`}
            >
              {todayIsGym ? 'Gym' : todayPlanEntry?.type || 'Rest'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
               {todayIsGym ? <Dumbbell className="text-blue-400" /> : <Flame className="text-amber-400" />}
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-tight">
                {formatPlanDetailText(todayPlanEntry?.activity) || 'Rest Day'}
              </p>
              <p className="text-xs text-gray-400 mt-1 italic line-clamp-3">
                {formatPlanDetailText(todayPlanEntry?.details) ||
                  'Enjoy your recovery! Stay active with steps.'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="glass-panel">
        <h2 className="text-xl font-semibold mb-4">Daily Goals</h2>
        <div className="flex flex-wrap justify-between gap-y-6 gap-x-1 sm:gap-x-2">
          <CircularProgress value={totalKcal} max={dailyGoals.kcal} color="#3b82f6" label="Kcal in" icon={<Flame size={20} />} />
          <CircularProgress
            value={totalBurnedKcal}
            max={burnGoalMax}
            color="#f97316"
            label="Burned"
            icon={<Zap size={20} />}
            sublabel={planSkipped ? 'steps only' : 'steps + plan'}
          />
          <CircularProgress value={totalProtein} max={dailyGoals.protein} color="#8b5cf6" label="Protein" icon={<Dumbbell size={20} />} />
          <CircularProgress value={totalCarbs} max={dailyGoals.carbs} color="#f59e0b" label="Carbs" icon={<Wheat size={20} />} />
          <CircularProgress value={totalFats} max={dailyGoals.fats} color="#ef4444" label="Fats" icon={<Droplet size={20} />} />
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-sm space-y-1">
          <p>
            <strong>Fiber:</strong> {totalFiber}g / {dailyGoals.fiber}g
          </p>
          <p className="text-xs text-gray-500">
            Burned ≈ {stepsKcalBurned} kcal steps
            {planSkipped
              ? ' · plan marked skipped (no session burn)'
              : ` + ${planKcalBurned} kcal from today's plan (MET estimate, ${weightKg}kg × ${sessionHours}h).`}
          </p>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-emerald-400"><Activity size={20} /> Activity</h3>
            <p className="text-3xl font-bold my-2">{steps.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Steps today (Google Fit)</p>
          </div>
          <button
            type="button"
            title="Refresh steps from Google Fit"
            disabled={stepsRefreshing}
            onClick={async () => {
              setStepsRefreshing(true);
              try {
                await refreshFitSteps();
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
        <h3 className="text-lg font-semibold border-b border-white/10 pb-2 mb-3">Recent Meals</h3>
        {dailyLogs.length === 0 ? (
          <p className="text-sm text-gray-400">No meals logged today. Add some from the Tracker or Library!</p>
        ) : (
          <ul className="space-y-3">
            {dailyLogs.map((log, i) => (
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={log.id || i}
                className="flex justify-between items-center gap-2 pb-3 border-b border-white/5 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="block font-medium">{log.name}</span>
                  <span className="text-xs text-gray-400">{log.category}</span>
                </div>
                <span className="font-semibold text-blue-400 shrink-0">{log.kcal} kcal</span>
                <button
                  type="button"
                  title="Remove meal"
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
    </motion.div>
  );
}
