export function buildWorkoutAgendaPrompt(args: {
  goal?: string;
  selectedDays: string[];
  durationHours: number;
  cardioPreference?: string;
  equipment?: string;
  experience?: string;
  limitations?: string;
}): string {
  const {
    goal,
    selectedDays,
    durationHours,
    cardioPreference,
    equipment,
    experience,
    limitations,
  } = args;
  const safeDurationHours = Number.isFinite(durationHours) ? durationHours : 1;
  const durationMinutes = Math.max(30, Math.round(safeDurationHours * 60));
  const warmupCooldown = 15;
  const workingMinutes = Math.max(15, durationMinutes - warmupCooldown);
  const exerciseCount = Math.min(8, Math.max(2, Math.round(workingMinutes / 12)));
  return `
Act as a world-class Strength & Conditioning Coach.
Create a 7-day personalized weekly agenda (Monday-Sunday).

User context:
- Goal: ${goal || 'maintain'}
- Gym sessions per week: ${selectedDays.length}
- Session duration: ${durationMinutes} minutes (${safeDurationHours} hours)
- Working time after warmup/cooldown: ${workingMinutes} minutes
- Specific Gym Days: ${selectedDays.join(', ')}
- Cardio Preference: ${cardioPreference || 'walk'}
- Available equipment: ${equipment || 'standard commercial gym'}
- Training experience: ${experience || 'beginner'}
- Injuries or limitations: ${limitations || 'none'}

TIME BUDGET RULES:
- Total session = ${durationMinutes} minutes
- Reserve 10 min warmup + 5 min cooldown = ${warmupCooldown} min
- Remaining working time = ${workingMinutes} minutes
- Each exercise takes approximately 10-12 minutes (sets + rest between sets)
- Therefore include exactly ${exerciseCount} exercises to fill the session
- Rest between sets: 60-90 seconds for hypertrophy, 2-3 min for strength
- Sets and reps must reflect the goal:
  - 'lose' or 'lose_gain': 3-4 sets x 12-15 reps (higher rep, shorter rest, more volume)
  - 'gain': 4-5 sets x 6-10 reps (heavier, longer rest, strength focus)
  - 'maintain': 3 sets x 10-12 reps (balanced)

RULES:
1. Gym days (${selectedDays.join(', ')}):
   - "activity" = session title (e.g. "Upper Body Strength", "Lower Body Power")
   - "details.summary" = 1-2 sentences on what the session targets and why
   - "details.workouts" = exactly ${exerciseCount} individual exercises
   - Each exercise must match the user's experience level and available equipment
   - Beginner: machines and simple barbell/dumbbell movements
   - Intermediate: compound free weight movements
   - Advanced: complex variations and plyometrics

2. Each gym exercise block must have:
   - "name": specific exercise name (e.g. "Dumbbell Romanian Deadlift")
   - "repsTimes": format "reps x sets" matching the goal rules above (e.g. "12-15 x 4")
   - "description": which muscles it targets and why it belongs in this session (1 sentence)
   - "youtube": always empty string ""

3. Non-gym days:
   - Assign one low-intensity recovery activity matching "${cardioPreference || 'walk'}"
   - Be specific (e.g. "35-min brisk walk targeting 8,000 steps")
   - "details.workouts" = ONE block with the cardio description, repsTimes as "", youtube as ""

4. Never assign two consecutive high-intensity days.
5. Minimum one full rest day per week.
6. Rest day: summary = short recovery tip, workouts = one block describing what to do (stretch, sleep, etc.)
7. Tone: motivating, direct, professional.

Output MUST be pure JSON format (No markdown, no talk):
{
  "Monday": {
    "type": "Gym",
    "activity": "Session Title",
    "details": {
      "summary": "What this day targets overall.",
      "workouts": [
        {
          "name": "Exercise Name",
          "repsTimes": "12-15 x 4",
          "description": "Muscles targeted and why.",
          "youtube": ""
        }
      ]
    }
  },
  "Tuesday": {
    "type": "Cardio",
    "activity": "Active Recovery Walk",
    "details": {
      "summary": "Light movement to aid recovery.",
      "workouts": [
        {
          "name": "Brisk Walk",
          "repsTimes": "",
          "description": "35-min walk targeting 8,000 steps at a conversational pace.",
          "youtube": ""
        }
      ]
    }
  }
}
`.trim();
}

export function buildAgendaImportPrompt(args: {
  currentPlanJson: string;
  userInstruction: string;
}): string {
  const { currentPlanJson, userInstruction } = args;
  return `
Act as an expert coach and schedule editor.
You will update an existing weekly agenda (Monday-Sunday) using user text and attached files.

Hard requirements:
1) Keep output as pure JSON only.
2) Preserve day keys exactly: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
3) Each day object must be:
{
  "type": "Gym/Cardio/Rest",
  "activity": "Short day title",
  "details": {
    "summary": "Brief overview",
    "workouts": [
      {
        "name": "Workout title (keep user-provided names when present)",
        "repsTimes": "reps x sets for gym blocks, else empty",
        "description": "What muscles/focus this block targets and why",
        "youtube": "https://www.youtube.com/watch?v=..."
      }
    ]
  }
}
4) If user gives a workout title, keep that title wording.
5) If youtube link is unknown, set youtube to empty string.
6) If user asks for only some days, keep the other days from current plan.
7) Never return markdown.

Current plan JSON:
${currentPlanJson}

User instruction:
${userInstruction || 'No typed instruction provided. Infer from attached files only.'}
`.trim();
}
