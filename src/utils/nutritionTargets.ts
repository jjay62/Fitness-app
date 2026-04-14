import type { Profile } from '../context/AppContext';

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
