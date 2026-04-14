import { formatPlanDetailText } from './workoutPlan';

export type AgendaWorkoutBlock = {
  name: string;
  repsTimes: string;
  description: string;
  youtube: string;
};

export type AgendaDetailView = {
  summary: string;
  workouts: AgendaWorkoutBlock[];
};

type LooseDetails = {
  summary?: unknown;
  workouts?: unknown;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return '';
}

function parseWorkoutArray(value: unknown): AgendaWorkoutBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = asString(row.name);
      const repsTimesDirect =
        asString(row.repsTimes) ||
        asString(row.reps_times) ||
        asString(row.repsXTimes) ||
        asString(row.rep_scheme);
      const sets = asNumString(row.sets);
      const reps = asNumString(row.reps);
      const repsTimes = repsTimesDirect || (sets && reps ? `${reps} x ${sets}` : '');
      const description = asString(row.description);
      const youtube = asString(row.youtube);
      if (!name && !description && !youtube) return null;
      return {
        name: name || 'Workout block',
        repsTimes,
        description,
        youtube,
      };
    })
    .filter((x): x is AgendaWorkoutBlock => Boolean(x));
}

function parseTextBlocks(rawDetails: string, fallbackTitle: string): AgendaWorkoutBlock[] {
  const lines = rawDetails
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const blocks: AgendaWorkoutBlock[] = [];
  let current: AgendaWorkoutBlock | null = null;

  for (const line of lines) {
    const youtubeMatch = line.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/i);
    if (youtubeMatch) {
      if (!current) {
        current = {
          name: fallbackTitle || 'Workout block',
          repsTimes: '',
          description: '',
          youtube: youtubeMatch[0],
        };
      } else {
        current.youtube = youtubeMatch[0];
      }
      continue;
    }

    const titleSplit = line.split(/\s[-:]\s/);
    if (titleSplit.length >= 2) {
      if (current) blocks.push(current);
      current = {
        name: titleSplit[0] || fallbackTitle || 'Workout block',
        repsTimes: '',
        description: titleSplit.slice(1).join(' - '),
        youtube: '',
      };
      continue;
    }

    if (!current) {
      current = { name: fallbackTitle || line, repsTimes: '', description: '', youtube: '' };
      continue;
    }

    current.description = [current.description, line].filter(Boolean).join(' ');
  }

  if (current) blocks.push(current);
  return blocks;
}

export function parseAgendaDetails(details: unknown, fallbackTitle: unknown): AgendaDetailView {
  const fallback = asString(fallbackTitle) || 'Workout';
  const textValue = formatPlanDetailText(details);

  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const d = details as LooseDetails;
    const summary = asString(d.summary) || textValue;
    const workouts = parseWorkoutArray(d.workouts);
    if (workouts.length > 0) {
      return { summary, workouts };
    }
  }

  const workouts = parseTextBlocks(textValue, fallback);
  if (workouts.length > 0) {
    return { summary: textValue, workouts };
  }

  return {
    summary: textValue,
    workouts: [{ name: fallback, repsTimes: '', description: textValue, youtube: '' }],
  };
}
