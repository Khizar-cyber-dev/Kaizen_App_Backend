import Journal from "../models/Journal.js";
import { getUTCDateOnly } from "../lib/helper.js";
import redis from "../config/redis.js";
import AppError from "../lib/AppError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import {
  generateDailyReflectionFromJournal,
  generateWeeklyInsightFromJournals,
} from "../services/journalAIService.js";

const WEEKLY_INSIGHT_TTL_SECONDS = 6 * 60 * 60;

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

export const createMorningJournal = asyncHandler(async (req, res) => {
  const { userId, morning } = req.body;

  if (!userId || !morning) {
    throw new AppError("Missing required fields", 400);
  }

  const normalizedDate = getUTCDateOnly();
  if (!normalizedDate) {
    throw new AppError("Invalid date", 400);
  }

  const validationError = validateJournalPayload({ morning });
  if (validationError) {
    throw new AppError(validationError, 400);
  }

  const existingJournal = await Journal.findOne({ userId, date: normalizedDate });
  if (existingJournal && existingJournal.morning) {
    throw new AppError("Morning journal already exists for today", 400);
  }

  const journal = await Journal.findOneAndUpdate(
    { userId, date: normalizedDate },
    {
      $set: {
        morning,
      },
      $setOnInsert: {
        userId,
        date: normalizedDate,
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
    message: "Morning journal saved successfully",
    journal,
  });
});

export const createEveningJournal = asyncHandler(async (req, res) => {
  const { userId, evening } = req.body;

  if (!userId || !evening) {
    throw new AppError("Missing required fields", 400);
  }

  const normalizedDate = getUTCDateOnly();
  if (!normalizedDate) {
    throw new AppError("Invalid date", 400);
  }

  const validationError = validateJournalPayload({ evening });
  if (validationError) {
    throw new AppError(validationError, 400);
  }

  const existingJournal = await Journal.findOne({ userId, date: normalizedDate });
  if (existingJournal && existingJournal.evening) {
    throw new AppError("Evening journal already exists for today", 400);
  }

  const journal = await Journal.findOneAndUpdate(
    { userId, date: normalizedDate },
    {
      $set: {
        evening,
      },
      $setOnInsert: {
        userId,
        date: normalizedDate,
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
    message: "Evening journal saved successfully",
    journal,
  });
});

export const getJournalByDate = asyncHandler(async (req, res) => {
  const { userId, date } = req.query;

  if (!userId || !date) {
    throw new AppError("Missing required fields", 400);
  }

  const normalizedDate = getUTCDateOnly(date);
  if (!normalizedDate) {
    throw new AppError("Invalid date", 400);
  }

  const journal = await Journal.findOne({ userId, date: normalizedDate });

  if (!journal) {
    throw new AppError("Journal entry not found for the given user and date", 404);
  }

  return res.status(200).json({ journal });
});

export const getJournalHistory = asyncHandler(async (req, res) => {
  const { userId, range } = req.query;

  if (!userId || !range) {
    throw new AppError("Missing required fields", 400);
  }

  let startDate = getUTCDateOnly();

  if (range === "week") {
    startDate.setUTCDate(startDate.getUTCDate() - 7);
  } else if (range === "month") {
    startDate.setUTCMonth(startDate.getUTCMonth() - 1);
  } else if (range !== "today") {
    startDate = getUTCDateOnly();
  }

  const journals = await Journal.find({
    userId,
    date: { $gte: startDate },
  }).sort({ date: 1 });

  return res.status(200).json({ journals });
});

export const getDailyAIReflection = asyncHandler(async (req, res) => {
  const { userId, askAdvice = false, userQuestion = "", date } = req.body;

  if (!userId) {
    throw new AppError("Missing required fields", 400);
  }

  const normalizedDate = date ? getUTCDateOnly(date) : getUTCDateOnly();
  if (!normalizedDate) {
    throw new AppError("Invalid date", 400);
  }

  const journal = await Journal.findOne({ userId, date: normalizedDate });
  if (!journal) {
    throw new AppError("Journal entry not found for the given user and date", 404);
  }

  if (!journal.morning || !journal.evening) {
    throw new AppError("Both morning and evening journal are required for daily AI reflection", 400);
  }

  const reflection = await generateDailyReflectionFromJournal({
    journal,
    askAdvice: Boolean(askAdvice),
    userQuestion: typeof userQuestion === "string" ? userQuestion : "",
  });

  journal.aiReflection = {
    text: reflection,
    model: "openai/gpt-oss-120b",
    generatedAt: new Date(),
  };

  await journal.save();

  return res.status(200).json({
    message: "Daily AI reflection generated",
    reflection,
    journalDate: normalizedDate,
  });
});

export const getWeeklyAIInsight = asyncHandler(async (req, res) => {
  const { userId, askAdvice = false, userQuestion = "" } = req.body;

  if (!userId) {
    throw new AppError("Missing required fields", 400);
  }

  const normalizedEndDate = getUTCDateOnly();

  const cacheKey = getWeeklyInsightCacheKey(userId, normalizedEndDate);
  let cached = null;
  try {
    cached = await redis.get(cacheKey);
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

  const journals = await Journal.find({
    userId,
    date: {
      $gte: startDate,
      $lte: normalizedEndDate,
    },
  }).sort({ date: 1 });

  if (journals.length === 0) {
    throw new AppError("No journal history found in the selected 7-day period", 404);
  }

  const insights = await generateWeeklyInsightFromJournals({
    journals: journals,
    askAdvice: Boolean(askAdvice),
    userQuestion: typeof userQuestion === "string" ? userQuestion : "",
  });

  const responsePayload = {
    message: "Weekly AI insight generated",
    period: {
      startDate,
      endDate: normalizedEndDate,
    },
    journalCount: journals.length,
    insights,
    fromCache: cached ? true : false,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(responsePayload), {
      ex: WEEKLY_INSIGHT_TTL_SECONDS,
    });
  } catch (cacheWriteError) {
    console.error("Weekly insight cache write failed:", cacheWriteError);
  }

  return res.status(200).json(responsePayload);
});
