'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../../context/AppContext';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Check, Loader2, ArrowLeft, Shield } from 'lucide-react';

export default function AIBodyFatPage() {
  const { geminiApiKey } = useApp();
  const router = useRouter();
  
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [sideImage, setSideImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [sidePreview, setSidePreview] = useState<string | null>(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File, side: 'front' | 'side') => {
    if (side === 'front') {
      setFrontImage(file);
      setFrontPreview(URL.createObjectURL(file));
    } else {
      setSideImage(file);
      setSidePreview(URL.createObjectURL(file));
    }
  };

  const analyzeBodyFat = async () => {
    if (!frontImage || !sideImage || !geminiApiKey) return;

    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        apiVersion: 'v1beta'
      });
      
      const getBase64 = (file: File): Promise<string> => 
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });

      const frontBase64 = await getBase64(frontImage);
      const sideBase64 = await getBase64(sideImage);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: "Estimate the body fat percentage of this person based on these two photos (front and side). Return ONLY the number (percentage), e.g., '15.5'. No other text." },
          { inlineData: { data: frontBase64, mimeType: frontImage.type } },
          { inlineData: { data: sideBase64, mimeType: sideImage.type } }
        ]
      });

      const text = response.text || '';
      const percentage = parseFloat(text);
      
      if (!isNaN(percentage)) {
        setResult(percentage);
      } else {
        throw new Error("Could not parse AI response");
      }
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes('429')) {
        alert('Daily AI Limit Reached (Google Project Level). Please create a NEW PROJECT in AI Studio to get a fresh key, or wait 24h.');
      } else {
        alert("Error analyzing photos. Please ensure they are clear shots of your physique.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmResult = () => {
    if (result) {
      router.push(`/setup?bf=${result}`);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-8">
      <header className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title text-2xl">AI Body Fat Calculator</h1>
      </header>

      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Shield size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-tight italic">
            <strong>Disclaimer:</strong> AI estimation is for reference only and not a medical measurement. Consult a professional for precise data.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 h-64">
          {/* Front Photo */}
          <div 
            className="relative border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 bg-white/5 cursor-pointer hover:border-blue-500/50 transition-colors overflow-hidden"
            onClick={() => frontInputRef.current?.click()}
          >
            {frontPreview ? (
              <img src={frontPreview} alt="Front" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <Camera size={24} className="text-gray-400 mb-2" />
                <span className="text-[10px] uppercase font-bold text-gray-400">Front Photo</span>
              </>
            )}
            <input type="file" ref={frontInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'front')} />
          </div>

          {/* Side Photo */}
          <div 
            className="relative border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 bg-white/5 cursor-pointer hover:border-blue-500/50 transition-colors overflow-hidden"
            onClick={() => sideInputRef.current?.click()}
          >
            {sidePreview ? (
              <img src={sidePreview} alt="Side" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <Camera size={24} className="text-gray-400 mb-2" />
                <span className="text-[10px] uppercase font-bold text-gray-400">Side Photo</span>
              </>
            )}
            <input type="file" ref={sideInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'side')} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key="analyze-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button 
                className="btn-primary w-full shadow-lg"
                disabled={!frontImage || !sideImage || analyzing}
                onClick={analyzeBodyFat}
              >
                {analyzing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>Calculate % with AI</>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="result-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="bg-blue-500/20 border border-blue-500/30 p-8 rounded-3xl">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-1">Estimated Fat %</p>
                <h2 className="text-6xl font-black text-white">{result}%</h2>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setResult(null)}>Retake</button>
                <button className="btn-primary flex-[2]" onClick={confirmResult}>
                  <Check size={20} className="mr-2" /> Use Result
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-center px-6">
        <p className="text-[10px] text-gray-500">
          Your photos are processed purely for estimation and are not stored permanently by the AI service.
        </p>
      </div>
    </div>
  );
}
