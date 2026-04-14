export type StrengthMusclePoint = {
  month: number;
  label: string;
  strengthIndex: number;
  leanMassKg: number;
};

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

export function strengthNarrative(): string {
  return 'For motivation only — not medical advice.';
}
