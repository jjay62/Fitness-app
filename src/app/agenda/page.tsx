'use client';

import React, { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
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
  Upload,
  FileText,
  MessageSquare,
  Link as LinkIcon,
} from 'lucide-react';
import Link from 'next/link';
import UserNav from '../../components/UserNav';
import { ProfileDataError } from '../../components/ProfileDataError';
import { WEEKDAYS, isGymType, formatPlanDetailText, type Weekday } from '../../utils/workoutPlan';
import { parseAgendaDetails } from '@/utils/agendaDetails';
import { buildAgendaImportPrompt } from '@/utils/aiPrompts';
import { amsterdamYmdForWeekdayName, getAmsterdamWeekdayLong } from '@/utils/amsterdamTime';
import {
  type AgendaCompletionStatus,
} from '@/context/AppContext';

const ALLOWED_AGENDA_FILE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function emptyWeeklyPlan(): Record<string, { type: string; activity: string; details: string }> {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      {
        type: 'Rest',
        activity: 'Rest & Recovery',
        details: '',
      },
    ])
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = String(reader.result || '');
      const base64 = raw.includes(',') ? raw.split(',')[1] : '';
      if (!base64) {
        reject(new Error('Could not read file content.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read file content.'));
    reader.readAsDataURL(file);
  });
}

export default function AgendaPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    profile,
    geminiApiKey,
    updateProfile,
    dataLoading,
    profileFetchError,
    refetchUserData,
    agendaCompletions,
    setAgendaCompletion,
  } = useApp();
  const router = useRouter();

  const [detailsDay, setDetailsDay] = useState<Weekday | null>(null);
  const [customAgendaText, setCustomAgendaText] = useState('');
  const [customAgendaFiles, setCustomAgendaFiles] = useState<File[]>([]);
  const [importingAgenda, setImportingAgenda] = useState(false);

  const todayAmsterdam = getAmsterdamWeekdayLong();

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  const markCompletion = async (day: Weekday, status: AgendaCompletionStatus) => {
    if (!user?.id) return;
    const key = amsterdamYmdForWeekdayName(day);
    const cur = agendaCompletions[key];
    const next = cur === status ? null : status;
    await setAgendaCompletion(key, next);
  };

  const handleAgendaFileSelection: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((file) => ALLOWED_AGENDA_FILE_TYPES.has(file.type)).slice(0, 5);
    setCustomAgendaFiles(valid);
  };

  const removeCustomFile = (idx: number) => {
    setCustomAgendaFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const importCustomAgenda = async () => {
    if (!geminiApiKey) {
      alert('Please add your Gemini API key in Settings first.');
      return;
    }
    if (!customAgendaText.trim() && customAgendaFiles.length === 0) {
      alert('Add your agenda notes or upload a PDF/PNG/JPEG first.');
      return;
    }

    setImportingAgenda(true);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
      const currentPlan = profile?.workout_plan ?? emptyWeeklyPlan();
      const prompt = buildAgendaImportPrompt({
        currentPlanJson: JSON.stringify(currentPlan, null, 2),
        userInstruction: customAgendaText.trim(),
      });
      const fileParts = await Promise.all(
        customAgendaFiles.map(async (file) => ({
          inlineData: { data: await fileToBase64(file), mimeType: file.type },
        }))
      );

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }, ...fileParts],
      });
      const text = (response.text || '').replace(/```json|```/g, '').trim();
      const plan = JSON.parse(text) as Record<string, { type?: string; activity?: string; details?: unknown }>;
      await updateProfile({ workout_plan: plan });
      setCustomAgendaText('');
      setCustomAgendaFiles([]);
      alert('Agenda updated and merged.');
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes('429')) {
        alert(
          'Daily AI limit reached. Create a new Google AI Studio project key or wait for quota reset.'
        );
      } else {
        alert('Could not import your custom agenda. Try with a clearer input.');
      }
    } finally {
      setImportingAgenda(false);
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

  if (!profile?.workout_plan) {
    return (
      <div className="max-w-md mx-auto py-8 px-4 pb-20">
        <UserNav />
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center px-4 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
              <Calendar size={40} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">No Agenda Found</h1>
            <p className="text-gray-400 mb-4 max-w-xs">
              You haven&apos;t generated your AI Workout Agenda yet. Create one or import your own.
            </p>
            <Link href="/setup/workout" className="btn-primary px-8 py-3 rounded-2xl">
              Generate Agenda
            </Link>
          </div>

          <div className="glass-panel p-4 space-y-3 border border-violet-500/20">
            <div className="flex items-center gap-2 text-violet-300">
              <Upload size={16} />
              <h2 className="font-bold text-sm">Import your own agenda</h2>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Upload a file pool (PDF/PNG/JPEG) or type your own workout notes. AI will build your weekly agenda.
            </p>
            <textarea
              value={customAgendaText}
              onChange={(e) => setCustomAgendaText(e.target.value)}
              placeholder="Example: Monday - Upper A, Incline Press 8 x 4, chest/triceps focus."
              className="w-full min-h-24 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <div className="space-y-2">
              <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <FileText size={12} /> File pool (optional)
              </label>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                multiple
                onChange={handleAgendaFileSelection}
                className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
              />
              {customAgendaFiles.length > 0 && (
                <div className="space-y-1.5">
                  {customAgendaFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="text-xs bg-white/5 rounded-lg px-2.5 py-2 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-gray-200">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomFile(idx)}
                        className="text-[10px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-gray-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void importCustomAgenda()}
              disabled={importingAgenda}
              className="w-full py-2.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-100 text-sm font-semibold hover:bg-violet-500/35 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importingAgenda ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={15} />}
              {importingAgenda ? 'Importing agenda...' : 'Build from my input'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const planForDetails = detailsDay ? profile.workout_plan?.[detailsDay] : undefined;
  const parsedDetails = parseAgendaDetails(planForDetails?.details, planForDetails?.activity);
  const isDetailGym = isGymType(planForDetails?.type);

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
          const doneState = agendaCompletions[dateKey];

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
                  <div className="flex flex-wrap items-center sm:gap-2 md:gap-20 pt-1">
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
        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          Need to change your plan? <span className="text-blue-500 font-semibold">Update in Settings</span>
        </p>
        <Link href="/setup/workout" className="text-xs text-violet-300 hover:text-violet-200 underline">
          add a new plan
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
                    Day overview
                  </h3>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                    {parsedDetails.summary ||
                      'No extra details for this day. Adjust your plan in Settings if you want more structure.'}
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Workout blocks
                  </h3>
                  {parsedDetails.workouts.map((block, idx) => (
                    (() => {
                      const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${block.name} exercise tutorial`
                      )}`;
                      return (
                        <div
                          key={`${block.name}-${idx}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                        >
                          <p className="text-sm font-bold text-white">
                            {idx + 1}. {block.name}
                            {block.repsTimes ? (
                              <span className="text-xs font-semibold text-blue-300 ml-1.5">{block.repsTimes}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-gray-300 leading-relaxed">{block.description}</p>
                          {isDetailGym && (
                            <a
                              href={youtubeSearchUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 underline underline-offset-2"
                            >
                              <LinkIcon size={12} /> YouTube video
                            </a>
                          )}
                        </div>
                      );
                    })()
                  ))}
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
