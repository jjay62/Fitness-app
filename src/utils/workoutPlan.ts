export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type PlanDay = { type?: string; activity?: unknown; details?: unknown };

/** AI plan fields may be objects/arrays; never call .trim() blindly. */
export function formatPlanDetailText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((x) => formatPlanDetailText(x))
      .filter((s) => s.length > 0)
      .join('\n');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

export function isGymType(type: unknown): boolean {
  return String(type ?? '')
    .trim()
    .toLowerCase() === 'gym';
}

/** Rough MET × kg × hours (structured session only; steps counted separately on dashboard). */
export function estimateWorkoutPlanKcalBurn(
  entry: PlanDay | undefined,
  weightKg: number,
  sessionHours: number
): number {
  if (!entry) return 0;
  const w =
    Number.isFinite(weightKg) && weightKg >= 40 && weightKg <= 250 ? weightKg : 70;
  const h =
    Number.isFinite(sessionHours) && sessionHours > 0 && sessionHours <= 6
      ? sessionHours
      : 1;

  const type = String(entry.type ?? '').trim().toLowerCase();
  const blob = `${type} ${formatPlanDetailText(entry.activity)} ${formatPlanDetailText(entry.details)}`.toLowerCase();

  if (type === 'rest') return 0;

  let met = 0;
  if (isGymType(entry.type) || blob.includes('strength') || blob.includes('lift')) {
    met = 5.5;
  } else if (blob.includes('run') || blob.includes('jog')) {
    met = 9;
  } else if (blob.includes('swim')) {
    met = 8;
  } else if (blob.includes('cycl') || blob.includes('bike')) {
    met = 7.5;
  } else if (blob.includes('walk')) {
    met = 3.5;
  } else if (type.includes('cardio') || blob.includes('hiit') || blob.includes('crossfit')) {
    met = 8;
  }

  if (met <= 0) return 0;
  return Math.round(met * w * h);
}

/** Running / walking preference: steps already reflect distance for those activities. */
export function isRunWalkCardioPreference(pref: string | undefined): boolean {
  const p = String(pref || '')
    .trim()
    .toLowerCase();
  return p === 'run' || p === 'walk';
}

/**
 * True when we should still add MET-based plan burn (gym, swim, etc.).
 * False for run/walk users on locomotion-style cardio days — steps cover kcal instead.
 */
export function agendaMetAppliesForPlanBurn(
  cardioPreference: string | undefined,
  entry: PlanDay | undefined
): boolean {
  if (!entry) return true;
  if (isGymType(entry.type)) return true;

  const t = String(entry.type ?? '')
    .trim()
    .toLowerCase();
  if (t === 'rest') return true;

  if (!isRunWalkCardioPreference(cardioPreference)) return true;

  const blob = `${t} ${formatPlanDetailText(entry.activity)} ${formatPlanDetailText(entry.details)}`.toLowerCase();
  const looksLikeLocomotionCardio =
    t.includes('cardio') || /\b(run|walk|jog|interval|stride|treadmill)\b/.test(blob);

  if (!looksLikeLocomotionCardio) return true;
  return false;
}

export function gymDaysFromPlan(plan: Record<string, PlanDay> | null | undefined): string[] {
  if (!plan) return [];
  return WEEKDAYS.filter((day) => plan[day] != null && isGymType(plan[day].type));
}

/**
 * Persist gym-day toggles into workout_plan so Save (and agenda) stay in sync.
 * Preserves non-gym day types/labels when possible; converts deselected gym days to Rest.
 */
export function mergeWorkoutPlanWithGymSelection(
  selectedDays: string[],
  existing: Record<string, PlanDay> | null | undefined
): Record<string, PlanDay> {
  const sel = new Set(selectedDays);
  const result: Record<string, PlanDay> = {};

  for (const day of WEEKDAYS) {
    const prev = existing?.[day];
    const prevGym = isGymType(prev?.type);

    if (sel.has(day)) {
      if (prevGym) {
        result[day] = {
          type: 'Gym',
          activity: prev?.activity || 'Gym Session',
          details: prev?.details || 'Strength training',
        };
      } else {
        result[day] = {
          type: 'Gym',
          activity: 'Gym Session',
          details: 'Strength training',
        };
      }
    } else if (prevGym) {
      result[day] = {
        type: 'Rest',
        activity: 'Rest & Recovery',
        details: 'Enjoy your recovery.',
      };
    } else {
      result[day] = {
        type: prev?.type && !isGymType(prev.type) ? prev.type : 'Rest',
        activity: prev?.activity || 'Rest & Recovery',
        details: prev?.details || '',
      };
    }
  }

  return result;
}
