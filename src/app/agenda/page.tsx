'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Dumbbell,
  Flame,
  Calendar,
  TrendingUp,
  Clock,
  Loader2,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';
import UserNav from '../../components/UserNav';
import { ProfileDataError } from '../../components/ProfileDataError';
import { WEEKDAYS, isGymType, formatPlanDetailText, type Weekday } from '../../utils/workoutPlan';
import { amsterdamYmdForWeekdayName, getAmsterdamWeekdayLong } from '@/utils/amsterdamTime';
import {
  loadAgendaCompletions,
  setAgendaCompletion,
  type AgendaCompletionStatus,
} from '@/lib/agendaCompletionStorage';

export default function AgendaPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, dataLoading, profileFetchError, refetchUserData } = useApp();
  const router = useRouter();

  const [detailsDay, setDetailsDay] = useState<Weekday | null>(null);
  const [completions, setCompletions] = useState<Record<string, AgendaCompletionStatus>>({});

  const todayAmsterdam = getAmsterdamWeekdayLong();

  const reloadCompletions = useCallback(() => {
    if (!user?.id) {
      setCompletions({});
      return;
    }
    setCompletions(loadAgendaCompletions(user.id));
  }, [user?.id]);

  useEffect(() => {
    reloadCompletions();
  }, [reloadCompletions]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('port62_agenda_v1_')) reloadCompletions();
    };
    const onLocal = () => reloadCompletions();
    window.addEventListener('storage', onStorage);
    window.addEventListener('port62-agenda-completion', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('port62-agenda-completion', onLocal);
    };
  }, [reloadCompletions]);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  const markCompletion = (day: Weekday, status: AgendaCompletionStatus) => {
    if (!user?.id) return;
    const key = amsterdamYmdForWeekdayName(day);
    const cur = completions[key];
    const next = cur === status ? null : status;
    setCompletions(setAgendaCompletion(user.id, key, next));
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

  if (!profile?.workout_plan) {
    return (
      <div className="max-w-md mx-auto py-8 px-4 pb-20">
        <UserNav />
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
            <Calendar size={40} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">No Agenda Found</h1>
          <p className="text-gray-400 mb-8 max-w-xs">
            You haven&apos;t generated your AI Workout Agenda yet. Let&apos;s get started!
          </p>
          <Link href="/setup/workout" className="btn-primary px-8 py-3 rounded-2xl">
            Generate Agenda
          </Link>
        </div>
      </div>
    );
  }

  const planForDetails = detailsDay ? profile.workout_plan?.[detailsDay] : undefined;

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-8 pb-20">
      <UserNav />

      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Weekly Agenda</h1>
        <div className="w-10" />
      </header>

      <div className="glass-panel p-4 flex items-center gap-4 bg-gradient-to-r from-blue-500/20 to-transparent border-blue-500/30">
        <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40">
          <TrendingUp className="text-white" size={24} />
        </div>
        <div>
          <h2 className="font-bold text-white">Weekly Focus</h2>
          <p className="text-xs text-blue-300">Tap ✓ if you trained, ✗ if you skipped.</p>
        </div>
      </div>

      <div className="space-y-4">
        {WEEKDAYS.map((day) => {
          const plan = profile.workout_plan[day];
          const isToday = day === todayAmsterdam;
          const isGym = isGymType(plan?.type);
          const dateKey = amsterdamYmdForWeekdayName(day);
          const doneState = completions[dateKey];

          return (
            <motion.div
              key={day}
              layout
              className={`glass-panel p-5 relative overflow-hidden transition-all ${
                isToday ? 'border-blue-500 ring-1 ring-blue-500/30 bg-blue-500/5' : 'border-white/5'
              }`}
            >
              {isToday && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                  Today
                </div>
              )}

              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm font-black uppercase tracking-widest shrink-0 ${
                      isToday ? 'text-blue-400' : 'text-gray-500'
                    }`}
                  >
                    {day}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate">{dateKey}</span>
                  {isToday && <Sparkles size={12} className="text-blue-400 shrink-0" />}
                </div>
                <div
                  className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                    isGym
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {isGym ? 'Gym' : plan?.type || 'Rest'}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isGym ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {isGym ? <Dumbbell size={20} /> : <Flame size={20} />}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-bold text-white leading-snug">
                    {formatPlanDetailText(plan?.activity) || 'Rest & Recovery'}
                  </p>
                  <p className="text-xs text-gray-400 line-clamp-2 italic">
                    {formatPlanDetailText(plan?.details) ||
                      'Enjoy your day off! Keep your step count high and stay hydrated.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDetailsDay(day)}
                      className="text-[11px] bg-white/10 px-3 py-1.5 rounded-lg font-semibold hover:bg-white/15 transition-colors text-white"
                    >
                      View details
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title={doneState === 'done' ? 'Clear (done)' : 'Mark completed'}
                        onClick={() => markCompletion(day, 'done')}
                        className={`p-2 rounded-xl border transition-colors ${
                          doneState === 'done'
                            ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300'
                            : 'bg-white/5 border-white/15 text-gray-400 hover:border-emerald-500/50 hover:text-emerald-400'
                        }`}
                      >
                        <Check size={18} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        title={doneState === 'skipped' ? 'Clear (skipped)' : 'Mark skipped'}
                        onClick={() => markCompletion(day, 'skipped')}
                        className={`p-2 rounded-xl border transition-colors ${
                          doneState === 'skipped'
                            ? 'bg-red-500/20 border-red-500 text-red-300'
                            : 'bg-white/5 border-white/15 text-gray-400 hover:border-red-500/50 hover:text-red-400'
                        }`}
                      >
                        <X size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isToday && (
                <div className="mt-4 pt-4 border-t border-blue-500/20 flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  <Clock size={10} />
                  {profile.workout_duration || 1}h session (estimate)
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="text-center py-4">
        <Link
          href="/settings"
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-1"
        >
          Need to change your plan? <span className="text-blue-500 font-semibold">Update in Settings</span>
        </Link>
      </div>

      <AnimatePresence>
        {detailsDay && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setDetailsDay(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="agenda-detail-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="w-full max-w-md max-h-[min(85vh,640px)] overflow-hidden rounded-2xl border border-white/15 bg-[#0f1419] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">
                    {detailsDay}
                  </p>
                  <h2 id="agenda-detail-title" className="text-lg font-bold text-white pr-2">
                    {formatPlanDetailText(planForDetails?.activity) || 'Workout'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {amsterdamYmdForWeekdayName(detailsDay)} · {planForDetails?.type || 'Plan'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsDay(null)}
                  className="p-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/15 shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[calc(min(85vh,640px)-88px)] space-y-4">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Full details
                  </h3>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                    {formatPlanDetailText(planForDetails?.details) ||
                      'No extra details for this day. Adjust your plan in Settings if you want more structure.'}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      markCompletion(detailsDay, 'done');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30"
                  >
                    <Check size={18} /> Did it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markCompletion(detailsDay, 'skipped');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 border border-red-500/35 text-red-300 text-sm font-semibold hover:bg-red-500/25"
                  >
                    <X size={18} /> Skipped
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
