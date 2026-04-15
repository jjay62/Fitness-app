import type { Profile } from '../context/AppContext';
import { GoogleGenAI } from '@google/genai';

export type DailyTargets = {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
};

const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_CARB = 4;
const KCAL_PER_GRAM_FAT = 9;

export const ACTIVITY_MODERATE = 1.465;

function parseNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function estimateBmrMsj(profile: Partial<Profile>): number {
  const weightKg = parseNum(profile.weight, 70);
  const heightCm = parseNum(profile.height, 175);
  const age = parseNum(profile.age, 30);
  const isMale = String(profile.gender || 'male').toLowerCase().startsWith('m');
  return isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function estimateTdeeModerate(profile: Partial<Profile>): number {
  return estimateBmrMsj(profile) * ACTIVITY_MODERATE;
}

export function trainingVolumeIndex(profile: Partial<Profile>): number {
  const freq = parseNum(profile.workout_frequency, 4);
  const duration = parseNum(profile.workout_duration, 1);
  const loadFromFreq = clamp((freq - 1) / 6, 0, 1);
  const loadFromDuration = clamp((duration - 0.5) / 2.5, 0, 1);
  return (loadFromFreq + loadFromDuration) / 2;
}

/**
 * Signed adjustment in kcal/day:
 * negative = deficit, positive = surplus.
 * Uses goal + workout volume so deficit/surplus is dynamic.
 */
export function calorieAdjustmentKcal(profile: Partial<Profile>): number {
  const goal = String(profile.goal || 'maintain').toLowerCase();
  const volume = trainingVolumeIndex(profile);

  if (goal === 'maintain') return 0;
  if (goal === 'gain') {
    return Math.round(200 + 100 * volume);
  }
  if (goal === 'lose') {
    return Math.round(clamp(-550 - 150 * volume, -720, -520));
  }
  if (goal === 'lose_gain') {
    return -500;
  }
  return 0;
}

export function targetKcalForProfile(profile: Partial<Profile>): number {
  const tdee = estimateTdeeModerate(profile);
  const adjusted = tdee + calorieAdjustmentKcal(profile);
  return Math.max(1200, Math.round(adjusted));
}

export function computeDailyTargets(profile: Partial<Profile>): DailyTargets {
  const kcal = targetKcalForProfile(profile);
  const weightKg = parseNum(profile.weight, 70);
  const bodyFat = clamp(parseNum(profile.body_fat_percentage, 20), 3, 55);
  const leanMassKg = Math.max(35, weightKg * (1 - bodyFat / 100));

  const protein = Math.round(leanMassKg * 2.2);
  const fats = Math.max(35, Math.round((kcal * 0.26) / KCAL_PER_GRAM_FAT));

  const kcalAfterProteinFat =
    kcal - protein * KCAL_PER_GRAM_PROTEIN - fats * KCAL_PER_GRAM_FAT;
  const carbs = Math.max(50, Math.round(kcalAfterProteinFat / KCAL_PER_GRAM_CARB));
  const fiber = Math.round((kcal / 1000) * 14);

  return { kcal, protein, carbs, fats, fiber };
}

export function nutritionRulesForPrompt(profile: Partial<Profile>): string {
  const volume = trainingVolumeIndex(profile);
  const delta = calorieAdjustmentKcal(profile);
  return [
    'Mandatory formulas and rules:',
    '1) BMR: Mifflin-St Jeor',
    `2) TDEE: BMR * ${ACTIVITY_MODERATE}`,
    '3) Dynamic goal adjustment based on workout volume (frequency + duration).',
    `4) Current workout volume index (0..1): ${volume.toFixed(2)}`,
    `5) Current signed calorie adjustment: ${delta} kcal/day`,
    '6) Protein: 2.2g per kg lean body mass',
    '7) Fats: 26% of calories',
    '8) Carbs: remaining calories',
    '9) Fiber: 14g per 1000 kcal',
  ].join('\n');
}

export function buildNutritionPrompt(profile: {
  gender: string;
  age: number;
  height: number;
  weight: number;
  bodyFat: number;
  goal: string;
}): string {
  const leanMass = profile.weight * (1 - profile.bodyFat / 100);

  return `
Act as a PhD-level Sports Nutritionist. Calculate precise daily nutritional targets
for this specific individual. Every number must be calculated from their exact data.

User Profile (use these exact values — do not use defaults or assumptions):
- Gender: ${profile.gender}
- Age: ${profile.age} years old
- Height: ${profile.height} cm
- Total weight: ${profile.weight} kg
- Body fat: ${profile.bodyFat}%
- Lean body mass: ${leanMass.toFixed(1)} kg
- Goal: ${profile.goal}

Step 1 — BMR (Mifflin-St Jeor):
${profile.gender === 'male'
  ? `Male: BMR = (10 × ${profile.weight}) + (6.25 × ${profile.height}) - (5 × ${profile.age}) + 5`
  : `Female: BMR = (10 × ${profile.weight}) + (6.25 × ${profile.height}) - (5 × ${profile.age}) - 161`
}

Step 2 — TDEE:
Moderately active (3x gym + daily walking) = BMR × 1.465

Step 3 — Caloric adjustment by goal:
- lose: TDEE - 500
- maintain: TDEE exactly
- gain: TDEE + 250
- lose_gain (recomp): TDEE - 500

Step 4 — Macros:
- Protein: ${leanMass.toFixed(1)} kg × 2.2 = Xg protein
- Fats: 26% of total calories ÷ 9
- Carbs: remaining calories after protein and fat ÷ 4
- Fiber: 14g per 1000 kcal

Output ONLY this JSON (no markdown, no explanation, no extra text):
{"kcal": number, "protein": number, "carbs": number, "fats": number, "fiber": number}
  `.trim();
}

function parseResponseJson(text: string): DailyTargets {
  const sanitized = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(sanitized) as Partial<DailyTargets>;
  return {
    kcal: Math.round(Number(parsed.kcal) || 0),
    protein: Math.round(Number(parsed.protein) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    fats: Math.round(Number(parsed.fats) || 0),
    fiber: Math.round(Number(parsed.fiber) || 0),
  };
}

export async function generateNutritionTargetsWithGemini(
  apiKey: string,
  profile: Partial<Profile>
): Promise<DailyTargets> {
  const gender = String(profile.gender || 'male');
  const age = Number(profile.age || 0);
  const height = Number(profile.height || 0);
  const weight = Number(profile.weight || 0);
  const bodyFat = Number(profile.body_fat_percentage || 0);
  const goal = String(profile.goal || 'maintain');

  console.log('Nutrition prompt profile:', { gender, age, height, weight, bodyFat, goal });

  const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  const prompt = buildNutritionPrompt({
    gender,
    age,
    height,
    weight,
    bodyFat,
    goal,
  });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{ text: prompt }],
  });
  return parseResponseJson(result.text || '');
}
