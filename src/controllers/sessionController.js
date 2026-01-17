import FocusSession from "../models/FocusSession.js";
import Habit from "../models/Habit.js";
import User from "../models/User.js";
import { parseDuration, formatDuration, calculateHabitSuccessRate, getUTCDateOnly, getAIReview } from "../lib/helper.js";
import { checkHabitAchievements, checkSessionTimeAchievements } from "./achievementController.js";

export async function startGeneralSession(req, res) {
  try {
    const { userId, title, intendedDuration, habitId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let sessionTitle = title;
    let parsedIntendedDuration = parseDuration(intendedDuration);

    if (habitId) {
      const habit = await Habit.findById(habitId);
      if (!habit) {
        return res.status(404).json({ message: "Habit not found" });
      }
      const today = getUTCDateOnly();
      if (habit.type === 'task') {
        // Find today's entry
        let todayEntry = habit.completionDates.find(
          d => getUTCDateOnly(d.date).getTime() === today.getTime()
        );

        if (!todayEntry) {
          todayEntry = { date: today, completed: true, sessionId: null };
          habit.totalSessionsCompleted += 1;
          habit.totalTimeSpent = null;

          habit.completionDates.push(todayEntry);
          habit.updateStreak(); // increase streak
        }


        await habit.save();

        return res.status(200).json({
          message: todayEntry.completed ? "Task marked done" : "Task unmarked",
          habit
        });
      }

      if (habit.todays_done === true) {
        return res.status(400).json({ message: "Today's habit session already completed" });
      }
      sessionTitle = habit.title;
      if (!intendedDuration) {
        parsedIntendedDuration = habit.sessionMinutes;
      }
      habit.totalSessionsStarted = (habit.totalSessionsStarted || 0) + 1;
      await habit.save();
    }

    const session = await FocusSession.create({
      userId,
      title: sessionTitle,
      intendedDuration: parsedIntendedDuration,
      startTime: new Date(),
      sessionType: habitId ? 'habit' : 'general',
      habitId: habitId || null,
      sessionNumber: user.nextSessionNumber,
      status: 'in_progress'
    });

    user.nextSessionNumber += 1;
    await user.save();

    return res.status(201).json({
      message: "Session started successfully",
      session
    });
  } catch (error) {
    console.log("Error in starting the session", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

export async function pauseSession(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await FocusSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const now = new Date();
    if (session.isPaused) {
      // Resuming
      const pauseDelta = now - session.lastPauseTime;
      session.totalPauseDuration = (session.totalPauseDuration || 0) + pauseDelta;
      session.isPaused = false;
      session.lastPauseTime = null;
    } else {
      // Pausing
      session.isPaused = true;
      session.lastPauseTime = now;
      session.interruptions += 1;
    }

    await session.save();

    res.status(200).json({
      message: session.isPaused ? "Session paused" : "Session resumed",
      session,
      isPaused: session.isPaused,
      interruptions: session.interruptions,
      totalPauseDuration: session.totalPauseDuration
    });
  } catch (error) {
    console.error("Error pausing session:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

// Close/end a session
export async function closeSession(req, res) {
  try {
    const { userId } = req.params;
    const { sessionId } = req.params;
    const { clientEndTime, remainingSeconds } = req.body;

    const session = await FocusSession.findById(sessionId);
    const user = await User.findById(userId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1. Handle Pause Closure FIRST if necessary
    const now = new Date();
    if (session.isPaused) {
      const pauseDelta = now - session.lastPauseTime;
      session.totalPauseDuration = (session.totalPauseDuration || 0) + pauseDelta;
      session.isPaused = false;
      session.lastPauseTime = null;
    }

    // 2. Calculate End Time and Duration
    if (remainingSeconds !== undefined && remainingSeconds !== null) {
      // Precise calculation: Intended - Remaining = Actual Consumed
      const intendedSeconds = session.intendedDuration * 60;
      const consumedSeconds = Math.max(0, intendedSeconds - remainingSeconds);

      // Back-calculate endTime to match this exact duration
      const startTimeMs = new Date(session.startTime).getTime();
      const totalPauseMs = session.totalPauseDuration || 0;
      session.endTime = new Date(startTimeMs + totalPauseMs + (consumedSeconds * 1000));

      session.actualDuration = parseFloat((consumedSeconds / 60).toFixed(2));
    } else {
      // Fallback calculation using start/end timestamps
      session.endTime = clientEndTime ? new Date(clientEndTime) : now;
      const totalElapsedMs = session.endTime - session.startTime;
      const focusTimeMs = totalElapsedMs - (session.totalPauseDuration || 0);
      session.actualDuration = Math.round((focusTimeMs / (1000 * 60)) * 100) / 100;
    }

    console.log(`Closing session: ${sessionId}. Actual: ${session.actualDuration}, Intended: ${session.intendedDuration}`);

    // Determine status based on completion
    if (session.actualDuration >= session.intendedDuration * 0.8) { // 80% or more completed
      session.status = 'completed';
      user.totalSessions += 1;
    } else {
      session.status = 'abandoned';
    }

    // 3. Generate AI Review - AFTER duration is calculated
    try {
      const aiReview = await getAIReview({
        sessionTitle: session.title,
        intendedDuration: session.intendedDuration,
        actualDuration: session.actualDuration,
        interruptions: session.interruptions || 0, // Pass number of interruptions
      });

      // Save AI rating and note
      session.rating = aiReview.rating;
      session.notes = aiReview.note;
      session.aiTips = aiReview.tips;
    } catch (aiError) {
      console.error("AI review generation failed:", aiError);
      session.notes = "Great work finishing your session!";
    }

    await session.save();

    // If it's a habit session, update the habit stats
    let newAchievements = [];
    let habitInfo = null;
    if (session.habitId) {
      const habit = await Habit.findById(session.habitId);
      if (habit) {

        // Only update streak and stats IF the session was actually completed
        if (session.status === 'completed') {
          habit.updateStreak();
          habit.totalSessionsCompleted += 1;
        }

        habit.totalTimeSpent += session.actualDuration;

        // Update completion dates
        const today = getUTCDateOnly();
        habit.completionDates.push({
          date: today,
          completed: session.status === 'completed', // Check status instead of duration again (consistency)
          sessionId: session._id
        });

        // Update metrics
        const completedSessions = session.status === 'completed' ? habit.totalSessionsCompleted : habit.totalSessionsCompleted; // Already updated above
        // Use max to avoid division by zero if it's the first failed session
        const div = completedSessions || 1;
        habit.averageSessionTime = habit.totalTimeSpent / div;

        // Calculate success rate
        habit.successRate = calculateHabitSuccessRate(habit);

        await habit.save();

        habitInfo = {
          currentStreak: habit.currentStreak,
          longestStreak: habit.longestStreak
        };
      }
    }

    // Check for new achievementstry 
    try {
      const habitAchievements = session.habitId ? await checkHabitAchievements(session.userId, session.habitId, await Habit.findById(session.habitId)) : [];
      const sessionMinutesAchievements = await checkSessionTimeAchievements(session.userId);
      newAchievements = [...habitAchievements, ...sessionMinutesAchievements];
    } catch (achievementError) {
      console.error('Error checking achievements:', achievementError);
    }

    await user.save();

    return res.status(200).json({
      message: "Session closed successfully",
      session,
      aiTips: session.aiTips,
      actualDurationFormatted: formatDuration(session.actualDuration),
      habit: habitInfo,
      newAchievements: newAchievements.length > 0 ? newAchievements : undefined
    });
  } catch (error) {
    console.error("Error closing session:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

export async function getSessionHistory(req, res) {
  try {
    const { userId } = req.params;
    const { range } = req.query;

    let startDate = getUTCDateOnly();

    if (range === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (range === 'today') {
      // already set to start of today
    } else {
      // Default to today if range is invalid or missing
      startDate = getUTCDateOnly();
    }

    const sessions = await FocusSession.find({
      userId,
      startTime: { $gte: startDate }
    }).sort({ startTime: -1 });

    res.status(200).json({
      message: "Session history retrieved successfully",
      sessions
    });
  } catch (error) {
    console.error("Error getting session history:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

export async function continueSession(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await FocusSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ message: "Completed sessions cannot be continued" });
    }

    if (session.status === 'in_progress') {
      return res.status(200).json({
        message: "Session is already in progress",
        session
      });
    }

    // Allow abandoned or continued statuses

    // Calculate gap between when it was abandoned and now
    // Treat this gap as an "interruption" or "pause" 
    const now = new Date();
    // Use endTime if available, otherwise fall back to updatedAt (e.g. if crashed/swiped), otherwise now
    const lastActiveTime = session.endTime || session.updatedAt || now;
    const gapMs = now - new Date(lastActiveTime);

    session.totalPauseDuration = (session.totalPauseDuration || 0) + gapMs;
    session.status = 'in_progress';
    session.endTime = null; // Re-open the session
    session.isPaused = false; // Ensure it's active
    session.lastPauseTime = null;

    await session.save();

    // Calculate remaining seconds to sync frontend
    let remainingSeconds = 0;
    if (session.status === 'in_progress') {
      const startTime = new Date(session.startTime);
      const now = new Date();
      const totalPauseMs = session.totalPauseDuration || 0;

      const elapsedMs = now - startTime - totalPauseMs;
      const intendedDurationMs = session.intendedDuration * 60 * 1000;

      const remainingMs = intendedDurationMs - elapsedMs;
      remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    }

    res.status(200).json({
      message: "Session resumed successfully",
      session,
      remainingSeconds
    });
  } catch (error) {
    console.error("Error resuming session:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

export async function getSessionById(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await FocusSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    let remainingSeconds = 0;
    if (session.status === 'in_progress') {
      const startTime = new Date(session.startTime);
      const now = new Date();
      const totalPauseMs = session.totalPauseDuration || 0;
      let elapsedMinutes = (now - startTime - totalPauseMs) / (1000 * 60);
      remainingSeconds = Math.max(0, Math.floor((session.intendedDuration - elapsedMinutes) * 60));
    }

    const formattedSession = {
      ...session,
      intendedDuration: Math.round(session.intendedDuration),
      actualDuration: session.actualDuration ? Math.round(session.actualDuration * 100) / 100 : 0
    };

    res.status(200).json({
      message: "Session retrieved successfully",
      session: formattedSession,
      remainingSeconds
    });
  } catch (error) {
    console.error("Error getting session by ID:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}
