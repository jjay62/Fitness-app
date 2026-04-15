import type { FoodItem, Profile } from '@/context/AppContext';
import { readNotificationPrefs } from '@/lib/notificationPrefs';
import { formatPlanDetailText, isGymType } from '@/utils/workoutPlan';

type DailyGoalsLike = {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
};

type EngineArgs = {
  userId: string;
  profile: Profile;
  dailyGoals: DailyGoalsLike;
  dailyLogs: FoodItem[];
  recentMealLogs7d: FoodItem[];
  currentSteps: number;
  agendaCompletions: Record<string, 'done' | 'skipped'>;
};

type EngineState = {
  sentByDay: Record<string, number>;
  sentKeys: Record<string, true>;
};

const ENGINE_STATE_PREFIX = 'port62_notification_engine_v1_';
const DEFAULT_STEP_TARGET = 8000;

function localYmd(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

function localHour(date: Date): number {
  return date.getHours();
}

function localMinute(date: Date): number {
  return date.getMinutes();
}

function localWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function weekdayFromYmd(ymd: string): string {
  return localWeekday(new Date(`${ymd}T12:00:00`));
}

function readEngineState(userId: string): EngineState {
  if (typeof window === 'undefined') return { sentByDay: {}, sentKeys: {} };
  try {
    const raw = window.localStorage.getItem(`${ENGINE_STATE_PREFIX}${userId}`);
    if (!raw) return { sentByDay: {}, sentKeys: {} };
    const parsed = JSON.parse(raw) as Partial<EngineState>;
    return {
      sentByDay: parsed.sentByDay && typeof parsed.sentByDay === 'object' ? parsed.sentByDay : {},
      sentKeys: parsed.sentKeys && typeof parsed.sentKeys === 'object' ? parsed.sentKeys : {},
    };
  } catch {
    return { sentByDay: {}, sentKeys: {} };
  }
}

function saveEngineState(userId: string, state: EngineState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${ENGINE_STATE_PREFIX}${userId}`, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function inTriggerWindow(now: Date, hour: number): boolean {
  return localHour(now) === hour && localMinute(now) < 15;
}

function isQuietHours(now: Date): boolean {
  const h = localHour(now);
  return h >= 22 || h < 8;
}

function parseStepTarget(planEntry: unknown): number {
  const text = formatPlanDetailText(planEntry);
  const match = text.match(/(\d{1,2}(?:[.,]\d{3})?)\s*steps?/i);
  if (!match) return DEFAULT_STEP_TARGET;
  const cleaned = match[1].replace(/[.,]/g, '');
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 1000 ? n : DEFAULT_STEP_TARGET;
}

function logsInWindow(logs: FoodItem[], ymd: string, startHour: number, endHour: number): FoodItem[] {
  return logs.filter((log) => {
    if (!log.logged_date) return false;
    const dt = new Date(log.logged_date);
    if (localYmd(dt) !== ymd) return false;
    const h = localHour(dt);
    return h >= startHour && h < endHour;
  });
}

function logsBeforeHour(logs: FoodItem[], ymd: string, hourExclusive: number): FoodItem[] {
  return logs.filter((log) => {
    if (!log.logged_date) return false;
    const dt = new Date(log.logged_date);
    if (localYmd(dt) !== ymd) return false;
    return localHour(dt) < hourExclusive;
  });
}

function aggregateKcal(logs: FoodItem[]): number {
  return logs.reduce((sum, log) => sum + (Number(log.kcal) || 0), 0);
}

function aggregateMacro(logs: FoodItem[], key: 'protein' | 'carbs' | 'fats' | 'fiber'): number {
  return logs.reduce((sum, log) => sum + (Number(log[key]) || 0), 0);
}

function hasHitAllGoalsToday(logs: FoodItem[], goals: DailyGoalsLike, currentSteps: number, stepTarget: number): boolean {
  const kcal = aggregateKcal(logs);
  const protein = aggregateMacro(logs, 'protein');
  const carbs = aggregateMacro(logs, 'carbs');
  const fats = aggregateMacro(logs, 'fats');
  const fiber = aggregateMacro(logs, 'fiber');
  return (
    kcal >= goals.kcal &&
    protein >= goals.protein &&
    carbs >= goals.carbs &&
    fats >= goals.fats &&
    fiber >= goals.fiber &&
    currentSteps >= stepTarget
  );
}

function workoutEncouragement(done: number, planned: number, avgKcal: number, kcalGoal: number, avgSteps: number, stepsGoal: number): string {
  if (planned > 0 && done >= planned && avgSteps >= stepsGoal && avgKcal >= kcalGoal * 0.9) {
    return 'Excellent consistency this week. Keep building on it.';
  }
  const ratio = planned > 0 ? done / planned : 0;
  if (ratio >= 0.7) {
    return 'Solid week overall. One more consistent week compounds fast.';
  }
  return 'Progress comes from consistency. Focus on one small daily win next week.';
}

async function sendBrowserNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  new Notification(title, { body });
  return true;
}

async function fetchStepsForDate(ymd: string): Promise<number> {
  try {
    const res = await fetch(`/api/steps?date=${ymd}`, { credentials: 'same-origin' });
    const data = (await res.json()) as { steps?: number };
    return res.ok && typeof data.steps === 'number' ? data.steps : 0;
  } catch {
    return 0;
  }
}

export async function evaluateAndSendNotifications(args: EngineArgs): Promise<void> {
  const { userId, profile, dailyGoals, dailyLogs, recentMealLogs7d, currentSteps, agendaCompletions } = args;
  if (!userId || typeof window === 'undefined') return;

  const prefs = readNotificationPrefs(userId);
  if (!prefs.enabled) return;

  const now = new Date();
  if (isQuietHours(now)) return;

  const ymd = localYmd(now);
  const weekday = localWeekday(now);
  const planEntry = profile?.workout_plan?.[weekday];
  const stepTarget = parseStepTarget(planEntry?.details ?? planEntry?.activity ?? '');
  const todayLogs =
    dailyLogs.length > 0
      ? dailyLogs
      : recentMealLogs7d.filter((log) => log.logged_date && localYmd(new Date(log.logged_date)) === ymd);

  if (hasHitAllGoalsToday(todayLogs, dailyGoals, currentSteps, stepTarget)) return;

  const state = readEngineState(userId);
  const sentCountToday = state.sentByDay[ymd] || 0;
  if (sentCountToday >= 3) return;

  const maybeSend = async (key: string, message: string, title = 'Port62') => {
    if (state.sentKeys[key]) return false;
    const dayCount = state.sentByDay[ymd] || 0;
    if (dayCount >= 3) return false;
    const sent = await sendBrowserNotification(title, message);
    if (!sent) return false;
    state.sentKeys[key] = true;
    state.sentByDay[ymd] = dayCount + 1;
    saveEngineState(userId, state);
    return true;
  };

  // Weekly summary has highest priority at the scheduled time.
  if (prefs.weeklySummary && weekday === 'Sunday' && inTriggerWindow(now, 19)) {
    const weeklyKey = `${ymd}:weekly-summary`;
    if (!state.sentKeys[weeklyKey]) {
      const dayYmds = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        return localYmd(d);
      });
      const plannedGym = dayYmds.filter((day) => {
        const wd = weekdayFromYmd(day);
        const entry = profile?.workout_plan?.[wd];
        return isGymType(entry?.type);
      }).length;
      const completedGym = dayYmds.filter((day) => agendaCompletions[day] === 'done').length;

      const kcalByDay: Record<string, number> = {};
      for (const day of dayYmds) kcalByDay[day] = 0;
      for (const log of recentMealLogs7d) {
        if (!log.logged_date) continue;
        const day = localYmd(new Date(log.logged_date));
        if (day in kcalByDay) kcalByDay[day] += Number(log.kcal) || 0;
      }
      const avgKcal = Math.round(dayYmds.reduce((s, day) => s + (kcalByDay[day] || 0), 0) / dayYmds.length);
      const avgStepsRaw = await Promise.all(dayYmds.map((day) => fetchStepsForDate(day)));
      const avgSteps = Math.round(avgStepsRaw.reduce((s, v) => s + v, 0) / dayYmds.length);
      const encouragement = workoutEncouragement(
        completedGym,
        plannedGym,
        avgKcal,
        dailyGoals.kcal,
        avgSteps,
        stepTarget
      );
      await maybeSend(
        weeklyKey,
        `This week you completed ${completedGym}/${plannedGym} workouts, averaged ${avgKcal} kcal/day and ${avgSteps} steps. ${encouragement}`
      );
    }
  }

  // Meal reminders
  if (prefs.mealReminders) {
    if (inTriggerWindow(now, 9) && logsBeforeHour(recentMealLogs7d, ymd, 9).length === 0) {
      await maybeSend(
        `${ymd}:meal-breakfast`,
        "Hey! Don't forget to log your breakfast. Tracking consistently is what gets you results. 💪"
      );
    }
    if (inTriggerWindow(now, 13) && logsInWindow(recentMealLogs7d, ymd, 9, 13).length === 0) {
      await maybeSend(
        `${ymd}:meal-lunch`,
        "Hey! Don't forget to log your lunch. Tracking consistently is what gets you results. 💪"
      );
    }
    if (inTriggerWindow(now, 19) && logsInWindow(recentMealLogs7d, ymd, 13, 19).length === 0) {
      await maybeSend(
        `${ymd}:meal-dinner`,
        "Hey! Don't forget to log your dinner. Tracking consistently is what gets you results. 💪"
      );
    }
  }

  // Workout reminder on gym days only.
  if (prefs.workoutReminder && inTriggerWindow(now, 17) && isGymType(planEntry?.type)) {
    const status = agendaCompletions[ymd];
    if (status !== 'done' && status !== 'skipped') {
      const sessionTitle = formatPlanDetailText(planEntry?.activity) || 'gym session';
      await maybeSend(
        `${ymd}:workout`,
        `You've got a ${sessionTitle} scheduled today. Get it done — future you will thank you. 🏋️`
      );
    }
  }

  // Walk/cardio reminder on non-gym, non-rest days.
  if (prefs.cardioReminder && inTriggerWindow(now, 15)) {
    const type = String(planEntry?.type || '').trim().toLowerCase();
    const isRest = type === 'rest';
    if (!isGymType(planEntry?.type) && !isRest && currentSteps < stepTarget) {
      await maybeSend(
        `${ymd}:cardio`,
        `You're at ${currentSteps.toLocaleString()} steps today, your goal is ${stepTarget.toLocaleString()}. A quick walk will get you there. 🚶`
      );
    }
  }

  // Keep state compact: retain only last 14 days.
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 14);
  const cutoffYmd = localYmd(cutoff);
  const trimmed: EngineState = { sentByDay: {}, sentKeys: {} };
  for (const [day, count] of Object.entries(state.sentByDay)) {
    if (day >= cutoffYmd) trimmed.sentByDay[day] = count;
  }
  for (const [key, value] of Object.entries(state.sentKeys)) {
    if (key.slice(0, 10) >= cutoffYmd) trimmed.sentKeys[key] = value;
  }
  saveEngineState(userId, trimmed);
}
