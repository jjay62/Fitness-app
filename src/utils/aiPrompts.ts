export function buildWorkoutAgendaPrompt(args: {
  goal?: string;
  selectedDays: string[];
  durationHours: number;
  cardioPreference?: string;
}): string {
  const { goal, selectedDays, durationHours, cardioPreference } = args;
  return `
Act as a world-class Strength & Conditioning Coach.
Create a 7-day personalized weekly agenda (Monday-Sunday).

User context:
- Goal: ${goal || 'maintain'}
- Gym sessions per week: ${selectedDays.length}
- Session duration: ${durationHours} hours
- Specific Gym Days: ${selectedDays.join(', ')}
- Cardio Preference: ${cardioPreference || 'run'}

RULES:
1. Gym Days (${selectedDays.join(', ')}): Provide a specific session title, training split type (e.g. Push/Pull/Legs or Full Body), and 3-4 key focus exercises or movement patterns.
2. Non-gym days: Assign low-intensity recovery activity matching "${cardioPreference || 'run'}". Keep it specific (e.g. "30-min walk targeting 8,000 steps" not just "rest").
3. Never assign two consecutive high-intensity days.
4. One full rest day per week minimum.
5. Tone: motivating, direct, professional.

Output MUST be pure JSON format exactly like this (No markdown, no talk):
{
  "Monday": { "type": "Gym/Cardio/Rest", "activity": "Title", "details": "Focus points or duration" },
  "...": {}
}
`.trim();
}
