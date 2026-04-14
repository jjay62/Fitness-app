'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { 
  Dumbbell, Clock, Calendar, Zap, 
  ChevronRight, Loader2, Sparkles, 
  CheckCircle2, Info, ArrowLeft
} from 'lucide-react';
import { buildWorkoutAgendaPrompt } from '@/utils/aiPrompts';

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
  'Friday', 'Saturday', 'Sunday'
];

const CARDIO_OPTIONS = [
  { id: 'run', name: 'Running', icon: '🏃' },
  { id: 'walk', name: 'Walking', icon: '🚶' },
  { id: 'cycle', name: 'Cycling', icon: '🚴' },
  { id: 'swim', name: 'Swimming', icon: '🏊' },
  { id: 'stairmaster', name: 'Stairmaster', icon: '🪜' },
  { id: 'crossfit', name: 'CrossFit', icon: '🏋️' }
];

export default function WorkoutSetupPage() {
  const { profile, updateProfile, geminiApiKey } = useApp();
  const router = useRouter();

  const [frequency, setFrequency] = useState(4);
  const [duration, setDuration] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [cardioPreference, setCardioPreference] = useState('run');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // GSAP Staggered entry for day picker
    gsap.fromTo(".day-bubble", 
      { opacity: 0, scale: 0.8, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "back.out(1.7)" }
    );
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      if (prev.length < frequency) {
        return [...prev, day];
      }
      return prev;
    });
  };

  const handleGeneratePlan = async () => {
    if (!geminiApiKey) {
      setError("AI Configuration missing. Please check your setup.");
      return;
    }
    
    if (selectedDays.length === 0) {
      setError("Please select at least one day for your workout.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        apiVersion: 'v1beta'
      });
      
      const prompt = buildWorkoutAgendaPrompt({
        goal: profile.goal,
        selectedDays,
        durationHours: duration,
        cardioPreference,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }]
      });

      let textResult = response.text || '';
      if (textResult.includes('```json')) textResult = textResult.split('```json')[1].split('```')[0];
      if (textResult.includes('```')) textResult = textResult.split('```')[1].split('```')[0];
      
      const workoutPlan = JSON.parse(textResult.trim());
      
      await updateProfile({ 
        workout_plan: workoutPlan,
        workout_frequency: frequency,
        workout_duration: duration,
        cardio_preference: cardioPreference,
        is_setup_complete: true 
      });

      router.push('/');
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes('429')) {
        setError('Daily AI Limit Reached (Google Quota). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
      } else {
        setError('Failed to generate workout plan. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-8 pb-12">
      <header className="flex flex-col items-center">
        <div className="w-full flex justify-start mb-4">
          <button 
            onClick={() => router.push('/setup/physical')}
            className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Dumbbell className="text-blue-400" size={32} />
        </div>
        <h1 className="page-title text-3xl mb-2">Workout Agenda</h1>
        <p className="text-gray-400">Step 2: Build your training schedule</p>
      </header>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center"
        >
          {error}
        </motion.div>
      )}

      {/* Frequency & Duration */}
      <div className="glass-panel space-y-8 p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-blue-400"><Zap size={16} /> Frequency</span>
            <span className="font-bold text-lg text-white">{frequency} <span className="text-gray-500 font-normal ml-0.5">days/week</span></span>
          </div>
          <input
            type="range" min="1" max="7"
            value={frequency}
            onChange={(e) => setFrequency(parseInt(e.target.value))}
            className="w-full custom-slider slider-blue"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-emerald-400"><Clock size={16} /> Session Time</span>
            <span className="font-bold text-lg text-white">{duration} <span className="text-gray-500 font-normal ml-0.5">hours</span></span>
          </div>
          <input
            type="range" min="0.5" max="3" step="0.5"
            value={duration}
            onChange={(e) => setDuration(parseFloat(e.target.value))}
            className="w-full custom-slider slider-emerald"
          />
        </div>
      </div>

      {/* Day Picker */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4 text-blue-400">
          <Calendar size={18} />
          <h3 className="text-sm font-bold uppercase tracking-wider">Select Training Days</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`day-bubble p-2 text-[10px] font-bold rounded-xl border transition-all ${
                selectedDays.includes(day) 
                  ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}
            >
              {day.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Cardio Selection */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-6 text-violet-400">
          <Zap size={18} />
          <h3 className="text-sm font-bold uppercase tracking-wider">Cardio Preference</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CARDIO_OPTIONS.map(opt => (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={opt.id}
              onClick={() => setCardioPreference(opt.id)}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                cardioPreference === opt.id
                  ? 'bg-violet-500/20 border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="text-xs font-bold">{opt.name}</span>
              {cardioPreference === opt.id && (
                <CheckCircle2 size={12} className="text-violet-400 absolute top-2 right-2" />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleGeneratePlan}
          disabled={loading}
          className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-[0_10px_30px_rgba(59,130,246,0.3)] shadow-blue-500/20"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <Sparkles size={24} /> Create Workout AI
            </>
          )}
        </button>

        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300 leading-tight">
            Your AI Workout Agenda will include custom gym routines for your training days and activity targets for rest days. 
          </p>
        </div>
      </div>
    </div>
  );
}
