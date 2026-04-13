export type StrengthMusclePoint = {
  month: number;
  label: string;
  strengthIndex: number;
  leanMassKg: number;
};

/**
 * Illustrative only: relative strength index + modeled lean-mass add-on (kg) vs time.
 * Not medical advice; real gains depend on training quality, sleep, genetics, etc.
 */
export function buildStrengthMuscleSeries(
  horizonMonths: number,
  opts: {
    weightKg: number;
    goal: string;
    sessionsPerWeek: number;
    proteinGPerDay: number;
    calorieSurplusPerDay?: number;
  }
): StrengthMusclePoint[] {
  const w = Math.max(45, opts.weightKg);
  const g = String(opts.goal || 'maintain').toLowerCase();
  const freq = Math.min(7, Math.max(0, opts.sessionsPerWeek));
  const protKg = opts.proteinGPerDay / w;
  const surplus = opts.calorieSurplusPerDay ?? 0;

  const goalMul = g.includes('gain') || g.includes('bulk') ? 1.12 : g.includes('lose') ? 0.72 : 1;
  const surplusMul = 1 + Math.max(-0.12, Math.min(0.12, surplus / 800));

  const out: StrengthMusclePoint[] = [];
  let strength = 100;
  let leanAdd = 0;

  for (let m = 0; m <= horizonMonths; m++) {
    if (m > 0) {
      const novice = Math.max(0.28, 1 - m * 0.055);
      const freqF = 0.35 + 0.65 * (freq / 5);
      const protF = Math.min(1.2, Math.max(0.65, protKg / 1.6));
      const monthStrength = 0.65 * novice * freqF * protF * goalMul * surplusMul;
      const monthLean = 0.06 * novice * freqF * protF * goalMul * surplusMul;
      strength += monthStrength;
      leanAdd += monthLean;
    }
    out.push({
      month: m,
      label: m === 0 ? 'Now' : `+${m}mo`,
      strengthIndex: Math.round(strength * 10) / 10,
      leanMassKg: Math.round(leanAdd * 100) / 100,
    });
  }

  return out;
}

export function strengthNarrative(goal: string, endStrength: number, endLean: number): string {
  const g = String(goal || '').toLowerCase();
  const dir =
    g.includes('lose') && !g.includes('gain')
      ? 'In a deficit, strength can still creep up for beginners; muscle gain is harder.'
      : g.includes('gain') || g.includes('bulk')
        ? 'A surplus supports faster strength and lean-mass curves in this model.'
        : 'Maintenance tends to favor slow recomposition-style progress.';
  return `${dir} By the end of the horizon the chart assumes about +${(endStrength - 100).toFixed(1)} index points and +${endLean.toFixed(2)} kg modeled lean tissue (illustrative).`;
}
