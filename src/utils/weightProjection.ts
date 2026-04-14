import type { Profile } from '../context/AppContext';

export const HORIZON_MONTHS = [1, 3, 4, 6, 9, 12] as const;
export type HorizonMonths = (typeof HORIZON_MONTHS)[number];

const ACTIVITY_FACTOR = 1.55;
const KCAL_PER_KG_FAT = 7700;
const AVG_DAYS_PER_MONTH = 30.44;

export function parseNum(v: string | number | undefined, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Mifflin–St Jeor BMR (kcal/day) */
export function estimateBmrKg(profile: Profile): number {
  const w = parseNum(profile.weight, 70);
  const h = parseNum(profile.height, 175);
  const age = parseNum(profile.age, 30);
  const isMale = String(profile.gender || 'male').toLowerCase().startsWith('m');
  if (isMale) {
    return 10 * w + 6.25 * h - 5 * age + 5;
  }
  return 10 * w + 6.25 * h - 5 * age - 161;
}

export function estimateTdee(profile: Profile): number {
  return estimateBmrKg(profile) * ACTIVITY_FACTOR;
}

/** Map each log to local calendar date string YYYY-MM-DD */
function dayKey(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Average daily kcal from logs in the last `days` calendar days (inclusive of today).
 * Falls back to null if no usable data (caller uses dailyGoals.kcal).
 */
export function averageDailyKcalFromLogs(
  logs: { kcal?: number; logged_date?: string }[],
  days = 7
): { avg: number; daysWithData: number; usedFallback: boolean } | null {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = dayKey(cutoff.toISOString());

  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.logged_date);
    if (!key || key < cutoffKey) continue;
    const k = Number(log.kcal) || 0;
    byDay.set(key, (byDay.get(key) ?? 0) + k);
  }

  if (byDay.size === 0) return null;

  let sum = 0;
  for (const v of byDay.values()) sum += v;
  return { avg: sum / byDay.size, daysWithData: byDay.size, usedFallback: false };
}

export function monthlyWeightDeltaKg(dailyBalanceKcal: number): number {
  return (dailyBalanceKcal / KCAL_PER_KG_FAT) * AVG_DAYS_PER_MONTH;
}

export function buildProjectionSeries(
  w0Kg: number,
  horizonMonths: number,
  monthlyDelta: number
): { month: number; weight: number }[] {
  const out: { month: number; weight: number }[] = [];
  for (let i = 0; i <= horizonMonths; i++) {
    out.push({ month: i, weight: Math.round((w0Kg + i * monthlyDelta) * 10) / 10 });
  }
  return out;
}

export function bmiKgM2(weightKg: number, heightCm: number): number | null {
  const hM = heightCm / 100;
  if (hM <= 0) return null;
  return Math.round((weightKg / (hM * hM)) * 10) / 10;
}

export function narrativeForProjection(params: {
  goal: string;
  startKg: number;
  endKg: number;
  horizonMonths: number;
  heightCm: number;
  usedIntakeFallback: boolean;
}): { outlook: string; appearance: string; benefits: string; disclaimer: string } {
  const { goal, startKg, endKg, horizonMonths, heightCm, usedIntakeFallback } = params;
  const delta = Math.round((endKg - startKg) * 10) / 10;
  const g = (goal || 'maintain').toLowerCase();

  const bmiStart = bmiKgM2(startKg, heightCm);
  const bmiEnd = bmiKgM2(endKg, heightCm);
  const bmiLine =
    bmiStart != null && bmiEnd != null
      ? `BMI moves from about ${bmiStart} to about ${bmiEnd} over this horizon (rough estimate only).`
      : '';

  let outlook = '';
  if (Math.abs(delta) < 0.5) {
    outlook = `Over ${horizonMonths} months, your projected weight stays near ${startKg} kg with your current estimated balance. That usually means energy in and activity are close to maintenance.`;
  } else if (delta < 0) {
    outlook = `Over ${horizonMonths} months, the model projects roughly ${Math.abs(delta)} kg loss (about ${(Math.abs(delta) / horizonMonths).toFixed(2)} kg per month on average), ending near ${endKg} kg. ${bmiLine}`;
  } else {
    outlook = `Over ${horizonMonths} months, the model projects roughly ${delta} kg gain, ending near ${endKg} kg. ${bmiLine}`;
  }

  if (usedIntakeFallback) {
    outlook += ' Logging meals improves this estimate.';
  }

  let appearance = '';
  if (g.includes('lose') && delta < -1) {
    appearance =
      'If lean mass is preserved with enough protein and training, you may notice a leaner waistline, more defined muscle, and clothes fitting looser as fat mass trends down.';
  } else if (g.includes('gain') && delta > 1) {
    appearance =
      'With structured training and gradual surplus, weight gain can show up as fuller muscles and strength gains; much of early change can also be water and glycogen.';
  } else if (g.includes('maintain') || Math.abs(delta) < 1) {
    appearance =
      'Staying near the same weight often means your shape changes slowly; consistency with steps, sleep, and protein still improves how you look and feel.';
  } else {
    appearance =
      'How you look week to week depends on training, sleep, sodium, and hydration—not just the scale.';
  }

  let benefits = '';
  if (delta < -0.5) {
    benefits =
      'Sustained fat loss, when done gradually, is associated with better blood pressure, blood sugar control, and joint load for many people—paired with resistance training to protect muscle.';
  } else if (delta > 0.5) {
    benefits =
      'Controlled weight gain can support strength and recovery when calories and protein align with your training; energy and mood often improve if you were under-fueling before.';
  } else {
    benefits =
      'Maintenance phases support habit stability, performance, and metabolic recovery between fat-loss or muscle-gain pushes.';
  }

  const disclaimer = 'Estimates only—for planning, not medical advice.';

  return { outlook, appearance, benefits, disclaimer };
}
