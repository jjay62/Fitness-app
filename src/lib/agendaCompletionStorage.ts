const STORAGE_PREFIX = 'port62_agenda_v1_';

export type AgendaCompletionStatus = 'done' | 'skipped';

export function loadAgendaCompletions(userId: string): Record<string, AgendaCompletionStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return {};
    return p as Record<string, AgendaCompletionStatus>;
  } catch {
    return {};
  }
}

export function setAgendaCompletion(
  userId: string,
  dateKey: string,
  status: AgendaCompletionStatus | null
): Record<string, AgendaCompletionStatus> {
  const cur = { ...loadAgendaCompletions(userId) };
  if (status === null) delete cur[dateKey];
  else cur[dateKey] = status;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(cur));
    window.dispatchEvent(new CustomEvent('port62-agenda-completion'));
  }
  return cur;
}
