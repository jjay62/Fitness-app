# AI Prompt Inventory

This document lists every active Gemini prompt in the app and what it is used for.

## Nutrition target generation

- **Status**: No longer prompt-driven.
- **Where now**:
  - `src/utils/nutritionTargets.ts`
  - Called from:
    - `src/app/setup/page.tsx`
    - `src/app/setup/physical/page.tsx`
    - `src/app/settings/page.tsx` (`generateDietPlan`)
- **Why**: Targets are now deterministic in TypeScript to avoid prompt drift and arithmetic mismatches.

## Workout plan generation (shared prompt)

- **Prompt source**: `src/utils/aiPrompts.ts` (`buildWorkoutAgendaPrompt`)
- **Used by**:
  - `src/app/setup/workout/page.tsx`
  - `src/app/settings/page.tsx` (`generateWorkoutPlan`)
- **Purpose**: Generate a 7-day workout/cardio/rest agenda in strict JSON.
- **Prompt template**:

```text
Act as a world-class Strength & Conditioning Coach.
Create a 7-day personalized weekly agenda (Monday-Sunday).

User context:
- Goal: <goal>
- Gym sessions per week: <selectedDays.length>
- Session duration: <durationHours> hours
- Specific Gym Days: <selectedDays>
- Cardio Preference: <cardioPreference>

RULES:
1. Gym Days (...) ...
2. Non-gym days: Assign low-intensity recovery activity matching cardio preference.
3. Never assign two consecutive high-intensity days.
4. One full rest day per week minimum.
5. Tone: motivating, direct, professional.

Output MUST be pure JSON...
```

## Progress narrative prompt

- **Source**: `src/app/progress/page.tsx`
- **Purpose**: Generate an honest 6-month outlook narrative (not formulas).
- **Prompt key points**:
  - Starts with role instruction:  
    `Act as a knowledgeable fitness coach giving an honest 6-month progress outlook.`
  - Uses computed targets from `nutritionTargets.ts`.
  - Explicitly tells model not to treat stored DB calorie goals as ground truth.
  - Requires strict JSON:
    `{"outlook":"","appearance":"","benefits":"","disclaimer":""}`

## Meal suggestions prompt

- **Source**: `src/app/suggestions/page.tsx`
- **Purpose**: Return 3 meal suggestions in strict JSON.
- **Prompt key points**:
  - Includes remaining kcal from computed target.
  - Includes remaining macros:
    - protein, carbs, fats
  - Explicitly prioritizes protein first:
    `Prioritize meals that help hit remaining protein first.`

## Food image analysis prompt

- **Source**: `src/app/tracker/page.tsx`
- **Purpose**: Estimate nutrition from food photo.
- **Prompt**:

```text
Analyze this image of food. Estimate the nutritional content.
Return ONLY a JSON object in this exact format exactly, with no markdown or other text:
{"name": "", "kcal": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0}
```

## Body-fat photo prompt

- **Source**: `src/app/setup/body-fat/page.tsx`
- **Purpose**: Estimate body fat percentage from front + side photos.
- **Prompt**:

```text
Estimate the body fat percentage of this person based on these two photos (front and side).
Return ONLY the number (percentage), e.g., '15.5'. No other text.
```

## Removed / replaced prompts

- Old nutrition prompts in:
  - `src/app/setup/page.tsx`
  - `src/app/setup/physical/page.tsx`
  - `src/app/settings/page.tsx` (`generateDietPlan`)
- Removed to prevent mismatch (e.g., 1.55 hardcoding, inconsistent protein rules, fixed deficits).
