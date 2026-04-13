'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { motion } from 'framer-motion';
import { Scale, Ruler, User as UserIcon, Activity, Sparkles, Loader2, Info } from 'lucide-react';
import Link from 'next/link';

function SetupForm() {
  const { user } = useAuth();
  const { updateProfileAndGoals, geminiApiKey, saveGeminiKey } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bodyFatParam = searchParams.get('bf');

  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(70);
  const [age, setAge] = useState(25);
  const [bodyFat, setBodyFat] = useState(15);
  const [gender, setGender] = useState('male');
  const [goal, setGoal] = useState('maintain');
  const [calculating, setCalculating] = useState(false);
  const [localApiKey, setLocalApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bodyFatParam) {
      setBodyFat(parseFloat(bodyFatParam));
    }
  }, [bodyFatParam]);

  const handleCompleteSetup = async () => {
    if (!user || !geminiApiKey) return;
    setCalculating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        apiVersion: 'v1beta'
      });
      const prompt = `
        Act as a PhD-level Sports Nutritionist. Calculate precise daily nutritional targets.
        
        Mandatory Formulas:
        1. BMR: Use Mifflin-St Jeor Equation.
        2. TDEE: Assume an 'Active' lifestyle (BMR * 1.55).
        
        Goal-Based Adjustments:
        - 'lose' (Lose weight/Maintain muscle): Subtract 500 kcal from TDEE.
        - 'maintain' (Maintain weight): Use TDEE exactly.
        - 'gain' (Bulk/Gain muscle): Add 300 kcal to TDEE.
        - 'lose_gain' (Body Recomposition): Use TDEE exactly but prioritize high protein .
        
        Macro Partitioning Rules:
        - Protein: Exactly 2.2g per kg of body weight for all goals to preserve/build muscle.
        - Fats: 25% of total calories.
        - Carbs: Remaining calories after protein and fat.
        - Fiber: 14g per 1000 kcal consumed.
        
        User Profile:
        - Gender: ${gender} | Age: ${age} | Height: ${height}cm | Weight: ${weight}kg | Body Fat: ${bodyFat}%
        - Main Goal: ${goal}

        Output MUST be pure JSON format (No markdown, no talk):
        {"kcal": number, "protein": number, "carbs": number, "fats": number, "fiber": number}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }]
      });

      let text = response.text || '';
      if (text.includes('```json')) text = text.split('```json')[1].split('```')[0];
      if (text.includes('```')) text = text.split('```')[1].split('```')[0];

      const parsedGoals = JSON.parse(text.trim());

      const newProfile = {
        height: height.toString(),
        weight: weight.toString(),
        age: age.toString(),
        gender,
        goal,
        body_fat_percentage: bodyFat,
        is_setup_complete: true,
      };

      await updateProfileAndGoals(newProfile, parsedGoals);
      router.push('/');
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes('429')) {
        setError('Daily AI Limit Reached (Google Quota). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
      } else {
        setError('AI Generation failed. Please check your API key and connection.');
      }
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-8">
      <header className="text-center">
        <h1 className="page-title text-4xl mb-2">Let's Setup</h1>
        <p className="text-gray-400">Personalize your journey for the best results</p>
      </header>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="glass-panel space-y-8 p-6">
        {/* Height Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-blue-400"><Ruler size={16} /> Height</span>
            <span className="font-bold text-lg text-white">{height} <span className="text-gray-500 font-normal ml-0.5">cm</span></span>
          </div>
          <input
            type="range" min="120" max="220"
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value))}
            className="w-full custom-slider slider-blue"
          />
        </div>

        {/* Weight Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-emerald-400"><Scale size={16} /> Weight</span>
            <span className="font-bold text-lg text-white">{weight} <span className="text-gray-500 font-normal ml-0.5">kg</span></span>
          </div>
          <input
            type="range" min="40" max="140" step="0.5"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
            className="w-full custom-slider slider-emerald"
          />
        </div>

        {/* Age Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-amber-400"><UserIcon size={16} /> Age</span>
            <span className="font-bold text-lg text-white">{age} <span className="text-gray-500 font-normal ml-0.5">y/o</span></span>
          </div>
          <input
            type="range" min="13" max="100"
            value={age}
            onChange={(e) => setAge(parseInt(e.target.value))}
            className="w-full custom-slider slider-amber"
          />
        </div>

        {/* Body Fat Slider */}
        <div className="space-y-4 pb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-violet-400"><Activity size={16} /> Body Fat %</span>
            <span className="font-bold text-lg text-white">{bodyFat} %</span>
          </div>
          <input
            type="range" min="3" max="50" step="0.5"
            value={bodyFat}
            onChange={(e) => setBodyFat(parseFloat(e.target.value))}
            className="w-full custom-slider slider-violet"
          />
          <div className="text-center mt-2 group">
            <Link
              href="/setup/body-fat"
              className="text-xs text-gray-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-1"
            >
              Don't know your body fat %?
              <span className="text-blue-500 font-semibold group-hover:underline">Use AI Calculator</span>
            </Link>
          </div>
        </div>

        {/* Gender and Goal Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="text-xs text-gray-500 mb-2 block uppercase font-bold tracking-wider">Gender</label>
            <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
              {['male', 'female'].map(g => (
                <button
                  key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${gender === g ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500 mb-2 block uppercase font-bold tracking-wider">Goal</label>
            <select
              value={goal} onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-medium outline-none focus:border-blue-500/50"
            >
              <option className='bg-gray-500 capitalize' value="lose">Lose Weight</option>
              <option className='bg-gray-500 capitalize' value="maintain">Maintain</option>
              <option className='bg-gray-500 capitalize' value="gain">Bulk Up</option>
              <option className='bg-gray-500 capitalize' value="lose_gain">Lose & Gain</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleCompleteSetup}
          disabled={calculating}
          className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-[0_10px_30px_rgba(59,130,246,0.3)] shadow-blue-500/20"
        >
          {calculating ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <Sparkles size={24} /> Generate My AI Plan
            </>
          )}
        </button>

        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-300 leading-tight">
            Our AI will calculate your ideal calorie and macro goals based on your biometric profile for precision accuracy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    }>
      <SetupForm />
    </Suspense>
  );
}
