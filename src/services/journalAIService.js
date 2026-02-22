import { groq } from "../config/groq.js";

const AI_MODEL = "openai/gpt-oss-120b";

function parseJsonResponse(rawText) {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (__error) {
      return null;
    }
  }
}

function compactJournalForPrompt(journal) {
  return {
    date: journal.date,
    morning: {
      gratefulFor: journal.morning?.gratefulFor || [],
      topPriorities: journal.morning?.topPriorities || [],
      affirmation: journal.morning?.affirmation || "",
    },
    evening: {
      amazingThings: journal.evening?.amazingThings || [],
      prioritiesStatus: journal.evening?.prioritiesStatus || "",
      improveTomorrow: journal.evening?.improveTomorrow || "",
    },
  };
}

export async function generateDailyReflectionFromJournal({
  journal,
  askAdvice = false,
  userQuestion = "",
}) {
  const journalData = compactJournalForPrompt(journal);

  const prompt = `
You are a neutral reflection companion for a productivity journaling app.

Write a DAILY REFLECTION based on the journal data.

Rules you must follow:
- Maximum 2 to 4 lines total.
- No judgment.
- No lecturing.
- Do not give advice unless the user explicitly asked for it.
- Focus on pattern awareness only (examples: focus pattern, gratitude themes, priority vs outcome mismatch).
- Keep it short, warm, and clear.
- No markdown, no bullet points.

User asked for advice: ${askAdvice ? "yes" : "no"}
User question (if any): ${userQuestion || "none"}

Journal data (JSON):
${JSON.stringify(journalData)}

Return ONLY valid JSON in this format:
{
  "reflection": "line 1\\nline 2"
}
`;

  const response = await groq.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.choices[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawText);

  if (!parsed?.reflection || typeof parsed.reflection !== "string") {
    throw new Error("Invalid AI daily reflection response");
  }

  return parsed.reflection.trim();
}

export async function generateWeeklyInsightFromJournals({
  journals,
  askAdvice = false,
  userQuestion = "",
}) {
  const compactJournals = journals.map((journal) => compactJournalForPrompt(journal));

  const prompt = `
You are a neutral weekly reflection analyst for a productivity journaling app.

Generate WEEKLY AI INSIGHTS from this user's last 7 days of journals.

Rules you must follow:
- No judgment.
- No lectures.
- Do not give advice unless user explicitly asked.
- Keep each insight concise (1 short sentence each).
- Focus only on patterns seen in journal text.

You must produce exactly these four insight fields:
1) repeatedGoals
2) moodToneTrends
3) consistencyPatterns
4) priorityEffectiveness

User asked for advice: ${askAdvice ? "yes" : "no"}
User question (if any): ${userQuestion || "none"}

Weekly journal data (JSON):
${JSON.stringify(compactJournals)}

Return ONLY valid JSON in this format:
{
  "repeatedGoals": "...",
  "moodToneTrends": "...",
  "consistencyPatterns": "...",
  "priorityEffectiveness": "..."
}
`;

  const response = await groq.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.choices[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawText);

  if (
    !parsed ||
    typeof parsed.repeatedGoals !== "string" ||
    typeof parsed.moodToneTrends !== "string" ||
    typeof parsed.consistencyPatterns !== "string" ||
    typeof parsed.priorityEffectiveness !== "string"
  ) {
    throw new Error("Invalid AI weekly insight response");
  }

  return {
    repeatedGoals: parsed.repeatedGoals.trim(),
    moodToneTrends: parsed.moodToneTrends.trim(),
    consistencyPatterns: parsed.consistencyPatterns.trim(),
    priorityEffectiveness: parsed.priorityEffectiveness.trim(),
  };
}
