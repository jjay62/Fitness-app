export type NotificationPrefs = {
  enabled: boolean;
  mealReminders: boolean;
  workoutReminder: boolean;
  cardioReminder: boolean;
  weeklySummary: boolean;
};

const PREFS_PREFIX = 'port62_notification_prefs_v1_';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  mealReminders: true,
  workoutReminder: true,
  cardioReminder: true,
  weeklySummary: true,
};

export function readNotificationPrefs(userId: string | undefined): NotificationPrefs {
  if (!userId || typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(`${PREFS_PREFIX}${userId}`);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPrefs(userId: string | undefined, prefs: NotificationPrefs): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${PREFS_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}
