import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export function calculateEndDate(startDate, type, customDays = null) {
  const start = new Date(startDate);
  switch (type) {
    case 'daily':
      return new Date(start.getTime() + 24 * 60 * 60 * 1000); // +1 day
    case 'week':
      return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
    case 'month':
      const monthly = new Date(start);
      monthly.setMonth(monthly.getMonth() + 1);
      return monthly;
    case '3_month':
      const quarter = new Date(start);
      quarter.setMonth(quarter.getMonth() + 3);
      return quarter;
    case '6_month':
      const half = new Date(start);
      half.setMonth(half.getMonth() + 6);
      return half;
    case 'year':
      const year = new Date(start);
      year.setFullYear(year.getFullYear() + 1);
      return year;
    case 'other':
      if (customDays && customDays > 0) {
        return new Date(start.getTime() + customDays * 24 * 60 * 60 * 1000);
      }
      return null;
    default:
      return null;
  }
}

/**
 * Calculates the current tier for a habit based on its streak.
 * Falls back to "Seedling" for a friendly empty state.
 */
export function calculateHabitTier(habit) {
  const streak = habit.currentStreak || 0;

  // Filter habit-specific achievements (type: consistency) and sort by streak threshold descending
  const habitMilestones = Object.values(ACHIEVEMENT_DEFINITIONS)
    .filter(def => def.type === 'consistency')
    .sort((a, b) => b.metadata.streak - a.metadata.streak);

  // Find the highest milestone achieved
  const currentMilestone = habitMilestones.find(m => streak >= m.metadata.streak);

  if (currentMilestone) {
    return getTierObject(currentMilestone.tier, currentMilestone.title);
  }

  // Friendly Empty/Initial State
  return {
    name: 'Unranked',
    title: 'Seedling',
    icon: 'leaf',
    color: '#10B981' // emerald-500
  };
}

function getTierObject(name, title) {
  return {
    name,
    title,
    icon: getTierIcon(name),
    color: getTierColor(name)
  };
}

function getTierIcon(tier) {
  const icons = {
    'bronze': 'medal',
    'silver': 'medal',
    'gold': 'trophy',
    'platinum': 'trophy',
    'diamond': 'diamond',
    'elite': 'shield',
    'legendary': 'flame',
    'mythic': 'flash'
  };
  return icons[tier?.toLowerCase()] || 'medal';
}

function getTierColor(tier) {
  const colors = {
    'bronze': '#CD7F32',
    'silver': '#C0C0C0',
    'gold': '#FFD700',
    'platinum': '#E5E4E2',
    'diamond': '#B9F2FF',
    'elite': '#FF4500', // Crimson/Orange for Elite
    'legendary': '#FFD700',
    'mythic': '#800080'
  };
  return colors[tier?.toLowerCase()] || '#9CA3AF';
}

export function calculateHabitSuccessRate(habit) {
  const uniqueCompletedDays = new Set(
    habit.completionDates
      .filter(cd => cd.completed)
      .map(cd => cd.date.toISOString().split("T")[0])
  ).size;

  const daysSinceCreated =
    Math.floor(
      (getUTCDateOnly() - getUTCDateOnly(habit.createdAt))
      / (1000 * 60 * 60 * 24)
    ) + 1;

  return daysSinceCreated > 0
    ? Math.min(100, (uniqueCompletedDays / daysSinceCreated) * 100)
    : 0;
}


export const ACHIEVEMENT_DEFINITIONS = {
  STREAK_3_DAYS: {
    title: 'Getting Started',
    description: 'Maintain a 3-day streak',
    type: 'streak',
    tier: 'bronze',
    badgeImage: '',
    metadata: { days: 3 }
  },
  STREAK_7_DAYS: {
    title: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    type: 'streak',
    tier: 'bronze',
    badgeImage: '',
    metadata: { days: 7 }
  },
  STREAK_14_DAYS: {
    title: 'Fortnight Fighter',
    description: 'Maintain a 14-day streak',
    type: 'streak',
    tier: 'silver',
    badgeImage: '',
    metadata: { days: 14 }
  },
  STREAK_21_DAYS: {
    title: 'Three-Week Thrill',
    description: 'Maintain a 21-day streak',
    type: 'streak',
    tier: 'silver',
    badgeImage: '',
    metadata: { days: 21 }
  },
  STREAK_30_DAYS: {
    title: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    type: 'streak',
    tier: 'silver',
    badgeImage: '',
    metadata: { days: 30 }
  },
  STREAK_100_DAYS: {
    title: 'Century Champion',
    description: 'Maintain a 100-day streak',
    type: 'streak',
    tier: 'gold',
    badgeImage: '',
    metadata: { days: 100 }
  },
  STREAK_180_DAYS: {
    title: 'Half-Year Hero',
    description: 'Maintain a 180-day streak',
    type: 'streak',
    tier: 'Platinum',
    badgeImage: '',
    metadata: { days: 180 }
  },
  STREAK_275_DAYS: {
    title: 'Nine-Month Ninja',
    description: 'Maintain a 275-day streak',
    type: 'streak',
    tier: 'Diamond',
    badgeImage: '',
    metadata: { days: 275 }
  },
  STREAK_365_DAYS: {
    title: 'Year of Excellence',
    description: 'Maintain a 365-day streak',
    type: 'streak',
    tier: 'Elite',
    badgeImage: '',
    metadata: { days: 365 }
  },
  STREAK_2_YEARS: {
    title: 'Two-Year Titan',
    description: 'Maintain a 2-year streak',
    type: 'streak',
    tier: 'legendary',
    badgeImage: '',
    metadata: { days: 730 }
  },
  STREAK_5_YEARS: {
    title: 'Five-Year Legend',
    description: 'Maintain a 5-year streak',
    type: 'streak',
    tier: 'mythic',
    badgeImage: '',
    metadata: { days: 1825 }
  },

  // Session time achievements (in hours)
  SESSIONS_10_HOURS: {
    title: 'Time Beginner',
    description: 'Spend 10 hours in focus sessions',
    type: 'milestone',
    tier: 'bronze',
    badgeImage: '',
    metadata: { sessions: 10 }
  },
  SESSIONS_50_HOURS: {
    title: 'Time Enthusiast',
    description: 'Spend 50 hours in focus sessions',
    type: 'milestone',
    tier: 'silver',
    badgeImage: '',
    metadata: { sessions: 50 }
  },
  SESSIONS_100_HOURS: {
    title: 'Century of Focus',
    description: 'Spend 100 hours in focus sessions',
    type: 'milestone',
    tier: 'gold',
    badgeImage: '',
    metadata: { sessions: 100 }
  },
  SESSIONS_250_HOURS: {
    title: 'Focus Pro',
    description: 'Spend 250 hours in focus sessions',
    type: 'milestone',
    tier: 'platinum',
    badgeImage: '',
    metadata: { sessions: 250 }
  },
  SESSIONS_500_HOURS: {
    title: 'Focus Master',
    description: 'Spend 500 hours in focus sessions',
    type: 'milestone',
    tier: 'diamond',
    badgeImage: '',
    metadata: { sessions: 500 }
  },
  SESSION_750_HOURS: {
    title: 'Focus Grandmaster',
    description: 'Spend 750 hours in focus sessions',
    type: 'milestone',
    tier: 'elite',
    badgeImage: '',
    metadata: { sessions: 750 }
  },
  SESSIONS_1000_HOURS: {
    title: 'Focus Legend',
    description: 'Spend 1000 hours in focus sessions',
    type: 'milestone',
    tier: 'legendary',
    badgeImage: '',
    metadata: { sessions: 1000 }
  },

  // Habit-specific achievements
  HABIT_STREAK_7_DAYS: {
    title: 'Habit Builder',
    description: 'Maintain a 7-day streak on a specific habit',
    type: 'consistency',
    tier: 'bronze',
    badgeImage: '',
    metadata: { streak: 7 }
  },
  HABIT_STREAK_14_DAYS: {
    title: 'Habit Developer',
    description: 'Maintain a 14-day streak on a specific habit',
    type: 'consistency',
    tier: 'silver',
    badgeImage: '',
    metadata: { streak: 14 }
  },
  HABIT_STREAK_21_DAYS: {
    title: 'Habit Expert',
    description: 'Maintain a 21-day streak on a specific habit',
    type: 'consistency',
    tier: 'gold',
    badgeImage: '',
    metadata: { streak: 21 }
  },
  HABIT_STREAK_30_DAYS: {
    title: 'Habit Master',
    description: 'Maintain a 30-day streak on a specific habit',
    type: 'consistency',
    tier: 'Diamond',
    badgeImage: '',
    metadata: { streak: 30 }
  },
  HABIT_STREAK_100_DAYS: {
    title: 'Habit Champion',
    description: 'Maintain a 100-day streak on a specific habit',
    type: 'consistency',
    tier: 'Elite',
    badgeImage: '',
    metadata: { streak: 100 }
  }
};

// Parse duration string like "1h 30m 45s" into total minutes
export function parseDuration(durationStr) {
  if (typeof durationStr === 'number') return durationStr;
  if (!durationStr || typeof durationStr !== 'string') return 0;

  const regex = /(\d+)\s*([hms])/gi;
  let totalMinutes = 0;
  let match;

  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'h':
        totalMinutes += value * 60;
        break;
      case 'm':
        totalMinutes += value;
        break;
      case 's':
        totalMinutes += value / 60;
        break;
      default:
        break;
    }
  }

  return totalMinutes;
}

// Format minutes into "xh ym zs" string, omitting zero units
export function formatDuration(totalMinutes) {
  if (totalMinutes <= 0) return '0s';

  const totalSeconds = Math.round(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

export function getUTCDateOnly(date = new Date()) {
  const d = new Date(date);
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  ));
}

export async function getAIReview({ sessionTitle, intendedDuration, actualDuration, interruptions }) {
  try {
    const interruptionsText =
      Array.isArray(interruptions) && interruptions.length > 0
        ? interruptions.join(", ")
        : "none";

    // Calculate completion percentage for better AI context
    const completionPercent = (actualDuration / intendedDuration) * 100;

    const prompt = `
      You are a high-performance productivity & focus coach.
      A user has just finished a focus session:
      - Title: "${sessionTitle}"
      - Target Goal: ${intendedDuration} minutes
      - Actual Time Focused: ${actualDuration} minutes
      - Completion: ${completionPercent.toFixed(1)}%
      - Occurrences of Interruption/Pause: ${interruptionsText}

      Your task is to review this session. Follow these guidelines:
      1. Appreciation: Start by acknowledging their effort. Even a short session is a win for discipline.
      2. Rating: Give a 1 to 5 star rating. 
         - 5 stars: Completed the full target with 0-1 interruptions.
         - 4 stars: Highly focused, mostly completed.
         - 3 stars: Good effort but needs more consistency.
         - 1-2 stars: Very high interruptions or very short compared to target.
      3. Insight (Note): Provide an encouraging, personalized summary. Use a professional yet motivating tone. Mention the title of their work.
      4. Growth Tip: Provide 1 actionable advice to help them stay deeper in focus next time (e.g., environment, mindset, physical state, or planning). Avoid technical advice about the app itself.

      Return JSON only in this format:
      {
        "rating": number,
        "note": "string",
        "tips": "string"
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 1,
      response_format: { type: "json_object" },
    });

    const text = chatCompletion.choices[0]?.message?.content || "";

    // Try to extract JSON safely
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // fallback if parsing fails
    return {
      rating: null,
      note: text.slice(0, 200), // just return first 200 chars of AI text
      tips: null,
    };
  } catch (error) {
    console.error("AI review generation error:", error);
    return {
      rating: null,
      note: "Unable to generate AI review.",
      tips: null,
    };
  }
}