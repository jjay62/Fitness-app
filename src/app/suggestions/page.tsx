'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, Loader2, Plus, ExternalLink, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserNav from '../../components/UserNav';
import { ProfileDataError } from '../../components/ProfileDataError';
import { computeDailyTargets } from '../../utils/nutritionTargets';

export default function Suggestions() {
  const { user, loading: authLoading } = useAuth();
  const { profile, geminiApiKey, dailyLogs, dailyGoals, addFoodToLog, dataLoading, profileFetchError, refetchUserData } = useApp();
  const router = useRouter();

  const [mealType, setMealType] = useState('Lunch');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [recipeOpenIndex, setRecipeOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

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

  const mealTypes = ['Breakfast', 'Snack', 'Lunch', 'Late night snack', 'Dinner'];

  const getSuggestions = async () => {
    if (!geminiApiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      return;
    }
    setLoading(true);
    setSuggestions([]);

    const targets = dailyGoals?.kcal ? dailyGoals : computeDailyTargets(profile);
    const consumedKcal = dailyLogs.reduce((acc, l) => acc + (l.kcal || 0), 0);
    const consumedProtein = dailyLogs.reduce((acc, l) => acc + (l.protein || 0), 0);
    const consumedCarbs = dailyLogs.reduce((acc, l) => acc + (l.carbs || 0), 0);
    const consumedFats = dailyLogs.reduce((acc, l) => acc + (l.fats || 0), 0);
    const remainingKcal = Math.max(targets.kcal - consumedKcal, 0);
    const remainingProtein = Math.max(targets.protein - consumedProtein, 0);
    const remainingCarbs = Math.max(targets.carbs - consumedCarbs, 0);
    const remainingFats = Math.max(targets.fats - consumedFats, 0);

    try {
      const ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        apiVersion: 'v1beta'
      });
      const prompt = `
        I need 3 meal suggestions for a ${mealType}.
        My profile: ${profile.gender}, ${profile.age} years. Goal: ${profile.goal}.
        I have ${remainingKcal} kcal remaining for today out of my computed ${targets.kcal} kcal target.
        Remaining macros: ${Math.round(remainingProtein)}g protein, ${Math.round(remainingCarbs)}g carbs, ${Math.round(remainingFats)}g fats.
        Prioritize meals that help hit remaining protein first.
        
        Generate exactly 3 healthy and engaging options. 
        Output MUST be pure JSON format array of exactly 3 objects with NO markdown and NO code blocks:
        [
          {
            "name": "Food Name",
            "description": "Brief yummy description",
            "kcal": 0,
            "protein": 0,
            "carbs": 0,
            "fats": 0,
            "fiber": 0,
            "category": "${mealType}",
            "recipe": {
              "ingredients": ["ingredient 1", "ingredient 2"],
              "steps": ["step 1", "step 2", "step 3"]
            },
            "youtube": ""
          }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }]
      });

      let text = response.text || '';
      if (text.startsWith('```json')) text = text.replace(/```json\n?/, '').replace(/```\n?$/, '');
      if (text.startsWith('```')) text = text.replace(/```\n?/, '').replace(/```\n?$/, '');

      const data = JSON.parse(text);
      setSuggestions(data);
    } catch (error: any) {
      console.error(error);
      if (error.status === 429 || error.message?.includes('429')) {
        alert('Daily AI Limit Reached (Google Project Level). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
      } else {
        alert("Failed to gather suggestions. Ensure your prompt and API key are correct.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLog = (item) => {
    const { name, category, kcal, protein, carbs, fats, fiber } = item;
    addFoodToLog({ name, category, kcal, protein, carbs, fats, fiber });
    alert(`Logged ${item.name} from suggestions!`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <UserNav />
      <header>
        <h1 className="page-title flex items-center gap-2"><Sparkles className="text-violet-400" /> AI Suggestions</h1>
        <p className="text-gray-400 text-sm mt-1">Get custom meal ideas tailored to your goals</p>
      </header>

      <div className="glass-panel text-center">
        <label className="text-sm text-gray-300 block mb-2 font-medium">What are you looking for?</label>
        <select
          className="input-field mb-4 appearance-none"
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
        >
          {mealTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          className="btn-primary w-full"
          onClick={getSuggestions}
          disabled={loading}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : "Suggest Meals"}
        </button>
      </div>

      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="font-semibold px-1">Here is what AI recommends:</h3>
            {suggestions.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.15 }}
                className="glass-panel p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-white text-lg">{item.name}</h4>
                    <p className="text-blue-400 font-semibold">{item.kcal} kcal</p>
                  </div>
                  <button
                    onClick={() => handleLog(item)}
                    className="bg-white/5 border border-white/10 p-2 rounded-full text-blue-400 hover:bg-blue-500/20 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <p className="text-sm text-gray-400 mb-3 leading-relaxed">{item.description}</p>

                <div className="flex gap-3 text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                  <span className="text-violet-300">P: {item.protein}g</span>
                  <span className="text-amber-300">C: {item.carbs}g</span>
                  <span className="text-emerald-300">F: {item.fats}g</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipeOpenIndex(idx)}
                    className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 rounded-lg text-gray-100"
                  >
                    <BookOpen size={13} /> View Recipe
                  </button>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.name} recipe`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/35 px-3 py-1.5 rounded-lg text-blue-200"
                  >
                    <ExternalLink size={13} /> Watch tutorial
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recipeOpenIndex != null && suggestions[recipeOpenIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setRecipeOpenIndex(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0f1419] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{suggestions[recipeOpenIndex].name}</h3>
                  <p className="text-xs text-gray-400 mt-1">{suggestions[recipeOpenIndex].description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipeOpenIndex(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2">Ingredients</h4>
                  <ul className="space-y-1.5">
                    {(suggestions[recipeOpenIndex].recipe?.ingredients || []).map((ingredient: string, i: number) => (
                      <li key={`${ingredient}-${i}`} className="text-sm text-gray-200">
                        • {ingredient}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2">Steps</h4>
                  <ol className="space-y-2">
                    {(suggestions[recipeOpenIndex].recipe?.steps || []).map((step: string, i: number) => (
                      <li key={`${step}-${i}`} className="text-sm text-gray-200 leading-relaxed">
                        {i + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
