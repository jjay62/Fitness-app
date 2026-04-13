'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { Camera, Upload, Check, Loader2, BookmarkPlus, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import UserNav from '../../components/UserNav';
import { ProfileDataError } from '../../components/ProfileDataError';

export default function MealTracker() {
  const { user, loading: authLoading } = useAuth();
  const { profile, geminiApiKey, addFoodToLog, addFoodToLibrary, dataLoading, profileFetchError, refetchUserData } = useApp();
  const router = useRouter();

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    if (!geminiApiKey) {
      alert("Please set your Gemini API key in Settings first.");
      return;
    }

    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        apiVersion: 'v1beta'
      });
      const reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              { text: "Analyze this image of food. Estimate the nutritional content. Return ONLY a JSON object in this exact format exactly, with no markdown or other text: {\"name\": \"\", \"kcal\": 0, \"protein\": 0, \"carbs\": 0, \"fats\": 0, \"fiber\": 0}" },
              { inlineData: { data: base64data, mimeType: image.type } }
            ]
          });

          let textResponse = response.text || '';
          if (textResponse.startsWith('```json')) {
            textResponse = textResponse.replace(/```json\n?/, '').replace(/```\n?$/, '');
          }
          if (textResponse.startsWith('```')) {
            textResponse = textResponse.replace(/```\n?/, '').replace(/```\n?$/, '');
          }

          const parsedResult = JSON.parse(textResponse);
          setResult({ ...parsedResult, category: categories[0] });
        } catch (error: any) {
          console.error("Gemini Error:", error);
          if (error.status === 429 || error.message?.includes('429')) {
             alert('Daily AI Limit Reached (Google Project Level). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
          } else {
             alert("Error analyzing image.");
          }
        } finally {
          setAnalyzing(false);
        }
      };
    } catch (error: any) {
      console.error(error);
      if (error.status === 429 || error.message?.includes('429')) {
         alert('Daily AI Limit Reached (Google Project Level). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
      }
      setAnalyzing(false);
    }
  };

  const validate = () => {
    if (!result.name.trim()) {
      alert("Name is required!");
      return false;
    }
    return true;
  };

  const saveLogOnly = () => {
    if (validate()) {
      addFoodToLog(result);
      reset();
      alert("Meal logged to dashboard!");
    }
  };

  const saveLogAndLibrary = () => {
    if (validate()) {
      addFoodToLog(result);
      addFoodToLibrary(result);
      reset();
      alert("Meal logged and saved to Library!");
    }
  };

  const reset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
  };

  const updateResult = (field, value) => {
    setResult(prev => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <UserNav />
      <header>
        <h1 className="page-title">Tracker</h1>
      </header>

      <div className="glass-panel text-center flex flex-col justify-center items-center min-h-[300px]">
        {!preview ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center">
            <Camera size={64} className="mb-4 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <p className="mb-6 text-gray-300 px-4">Snap a photo and let AI calculate your macros instantly.</p>

            <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
              <button className="btn-primary w-full" onClick={() => fileInputRef.current.click()}>
                <Upload size={20} /> AI Scan
              </button>
              
              <div className="flex items-center gap-3 w-full my-1">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">OR</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <Link href="/library" className="btn-secondary w-full border-white/10 flex items-center justify-center gap-2">
                <Book size={18} /> Library
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="w-full">
            <img src={preview} alt="Meal" className="w-full max-h-[300px] object-cover rounded-2xl mb-4 shadow-lg border border-white/10" />

            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div key="analyze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 justify-center">
                  <button className="btn-secondary" onClick={reset} disabled={analyzing}>Retake</button>
                  <button className="btn-primary w-40" onClick={analyzeImage} disabled={analyzing}>
                    {analyzing ? <Loader2 size={20} className="animate-spin" /> : "Analyze"}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-left">
                  <h3 className="border-b border-white/10 pb-2 mb-4 font-semibold">Macros & Details</h3>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-xs text-gray-400">Name <span className="text-red-500">*</span></label>
                      <input className="input-field" value={result.name} onChange={(e) => updateResult('name', e.target.value)} required />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Category <span className="text-red-500">*</span></label>
                      <select className="input-field appearance-none" value={result.category} onChange={(e) => updateResult('category', e.target.value)}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400">Calories (kcal)</label>
                        <input type="number" className="input-field" value={result.kcal} onChange={(e) => updateResult('kcal', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Protein (g)</label>
                        <input type="number" className="input-field" value={result.protein} onChange={(e) => updateResult('protein', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Carbs (g)</label>
                        <input type="number" className="input-field" value={result.carbs} onChange={(e) => updateResult('carbs', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Fats (g)</label>
                        <input type="number" className="input-field" value={result.fats} onChange={(e) => updateResult('fats', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button className="btn-primary w-full" onClick={saveLogOnly}>
                      <Check size={20} /> Log to Today
                    </button>
                    <div className="flex gap-3">
                      <button className="btn-secondary flex-1 border-white/10" onClick={reset}>Discard</button>
                      <button className="btn-secondary flex-[2] bg-violet-600/20 border-violet-500/50 text-violet-300 hover:bg-violet-600/40" onClick={saveLogAndLibrary}>
                        <BookmarkPlus size={20} className="inline mr-2" />
                        Log & Save to Library
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
