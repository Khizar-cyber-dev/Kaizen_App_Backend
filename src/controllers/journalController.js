import Journel from "../models/Journel.js";
import { getUTCDateOnly } from "../lib/helper.js";
import redis from "../config/redis.js";
import {
  generateDailyReflectionFromJournal,
  generateWeeklyInsightFromJournals,
} from "../services/journalAIService.js";

const WEEKLY_INSIGHT_TTL_SECONDS = 6 * 60 * 60;

function normalizeDateOnly(dateInput) {
  const parsed = new Date(dateInput);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getUTCDateOnly(parsed);
}

function hasMoreThanThree(items) {
  return Array.isArray(items) && items.length > 3;
}

function formatUTCDateOnly(date) {
  return date.toISOString().split("T")[0];
}

function getWeeklyInsightCacheKey(userId, endDate) {
  return `journal:weekly-insight:${userId}:${formatUTCDateOnly(endDate)}`;
}

async function invalidateWeeklyInsightCache(userId, journalDate) {
  try {
    const keys = [];

    // A journal date contributes to weekly windows ending on D..D+6.
    for (let i = 0; i <= 6; i += 1) {
      const endDate = new Date(journalDate);
      endDate.setUTCDate(endDate.getUTCDate() + i);
      keys.push(getWeeklyInsightCacheKey(userId, endDate));
    }

    await Promise.all(keys.map((key) => redis.del(key)));
  } catch (error) {
    console.error("Weekly insight cache invalidation failed:", error);
  }
}

function validateJournalPayload({ morning, evening }) {
  if (morning) {
    if (hasMoreThanThree(morning.gratefulFor)) {
      return "Morning grateful list can contain maximum 3 items";
    }

    if (hasMoreThanThree(morning.topPriorities)) {
      return "Morning top priorities can contain maximum 3 items";
    }
  }

  if (evening) {
    if (hasMoreThanThree(evening.amazingThings)) {
      return "Evening amazing things can contain maximum 3 items";
    }
  }

  return null;
}

export const createMorningJournel = async (req, res) => {
  try {
    const { userId, date, morning } = req.body;

    if (!userId || !date || !morning) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const validationError = validateJournalPayload({ morning });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const journel = await Journel.findOneAndUpdate(
      { userId, date: normalizedDate },
      {
        $set: {
          userId,
          date: normalizedDate,
          morning,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    await invalidateWeeklyInsightCache(userId, normalizedDate);

    return res.status(201).json({
      message: "Morning journel saved successfully",
      journel,
    });
  } catch (error) {
    console.error("Error saving morning journel:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createEveningJournel = async (req, res) => {
  try {
    const { userId, date, evening } = req.body;

    if (!userId || !date || !evening) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const validationError = validateJournalPayload({ evening });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const journel = await Journel.findOneAndUpdate(
      { userId, date: normalizedDate },
      {
        $set: {
          userId,
          date: normalizedDate,
          evening,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    await invalidateWeeklyInsightCache(userId, normalizedDate);

    return res.status(200).json({
      message: "Evening journel saved successfully",
      journel,
    });
  } catch (error) {
    console.error("Error saving evening journel:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getJournelByDate = async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!userId || !date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const journel = await Journel.findOne({ userId, date: normalizedDate });

    if (!journel) {
      return res
        .status(404)
        .json({ message: "Journel entry not found for the given user and date" });
    }

    return res.status(200).json({ journel });
  } catch (error) {
    console.error("Error fetching journel by date:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getJournelHistory = async (req, res) => {
  try {
    const { userId, range } = req.query;

    if (!userId || !range) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let startDate = getUTCDateOnly();

    if (range === "week") {
      startDate.setUTCDate(startDate.getUTCDate() - 7);
    } else if (range === "month") {
      startDate.setUTCMonth(startDate.getUTCMonth() - 1);
    } else if (range !== "today") {
      startDate = getUTCDateOnly();
    }

    const journels = await Journel.find({
      userId,
      date: { $gte: startDate },
    }).sort({ date: 1 });

    return res.status(200).json({ journels });
  } catch (error) {
    console.error("Error fetching journel history:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getDailyAIReflection = async (req, res) => {
  try {
    const { userId, date, askAdvice = false, userQuestion = "" } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const journel = await Journel.findOne({ userId, date: normalizedDate });
    if (!journel) {
      return res
        .status(404)
        .json({ message: "Journel entry not found for the given user and date" });
    }

    if (!journel.morning || !journel.evening) {
      return res.status(400).json({
        message: "Both morning and evening journal are required for daily AI reflection",
      });
    }

    const reflection = await generateDailyReflectionFromJournal({
      journal: journel,
      askAdvice: Boolean(askAdvice),
      userQuestion: typeof userQuestion === "string" ? userQuestion : "",
    });

    journel.aiReflection = {
      text: reflection,
      model: "openai/gpt-oss-120b",
      generatedAt: new Date(),
    };

    await journel.save();

    return res.status(200).json({
      message: "Daily AI reflection generated",
      reflection,
      journalDate: normalizedDate,
    });
  } catch (error) {
    console.error("Error generating daily AI reflection:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getWeeklyAIInsight = async (req, res) => {
  try {
    const { userId, endDate, askAdvice = false, userQuestion = "" } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEndDate = normalizeDateOnly(endDate || new Date());
    if (!normalizedEndDate) {
      return res.status(400).json({ message: "Invalid endDate" });
    }

    const cacheKey = getWeeklyInsightCacheKey(userId, normalizedEndDate);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsedCached = JSON.parse(cached);
        return res.status(200).json({
          ...parsedCached,
          fromCache: true,
        });
      }
    } catch (cacheReadError) {
      console.error("Weekly insight cache read failed:", cacheReadError);
    }

    const startDate = new Date(normalizedEndDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);

    const journels = await Journel.find({
      userId,
      date: {
        $gte: startDate,
        $lte: normalizedEndDate,
      },
    }).sort({ date: 1 });

    if (journels.length === 0) {
      return res.status(404).json({
        message: "No journal history found in the selected 7-day period",
      });
    }

    const insights = await generateWeeklyInsightFromJournals({
      journals: journels,
      askAdvice: Boolean(askAdvice),
      userQuestion: typeof userQuestion === "string" ? userQuestion : "",
    });

    const responsePayload = {
      message: "Weekly AI insight generated",
      period: {
        startDate,
        endDate: normalizedEndDate,
      },
      journalCount: journels.length,
      insights,
      fromCache: false,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(responsePayload), {
        ex: WEEKLY_INSIGHT_TTL_SECONDS,
      });
    } catch (cacheWriteError) {
      console.error("Weekly insight cache write failed:", cacheWriteError);
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error generating weekly AI insight:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
