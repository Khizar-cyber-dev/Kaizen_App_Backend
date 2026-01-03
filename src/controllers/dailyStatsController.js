import FocusSession from "../models/FocusSession.js";
import User from "../models/User.js";
import Habit from "../models/Habit.js";
import { getUTCDateOnly } from "../lib/helper.js";

export async function getUserCurrentData(req, res) {
  try {
    const { userId } = req.params;
    const sessions = await FocusSession.find({ userId, status: 'completed' });
    const durations = sessions.map(session => session.actualDuration || 0);
    const user = await User.findById(userId);

    res.status(200).json({
      message: "User Session durations and Streak retrieved successfully",
      durations,
      userCurrentStreak: user.currentStreak,
      userLongestStreak: user.longestStreak,
      userMissingDays: user.missingDays
    });
  } catch (error) {
    console.error("Error retrieving session durations:", error);
    res.status(500).json({
      message: "Failed to retrieve session durations",
      error: error.message
    });
  }
}

export async function getDonutChartData(req, res) {
  try {
    const { userId } = req.params;

    // Get all sessions
    const allSessions = await FocusSession.find({ userId }).populate('habitId', 'title color');

    // Get completed sessions
    const sessions = allSessions.filter(session => session.status === 'completed');

    // Calculate success rate
    const totalSessions = allSessions.length;
    const completedSessions = sessions.length;
    const successRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Group by title
    const titleMap = {};

    for (const session of sessions) {
      const title = session.title;
      if (!titleMap[title]) {
        titleMap[title] = {
          habitId: session.habitId?._id || null,
          title,
          color: session.habitId?.color || '#4F46E5',
          totalDuration: 0,
          sessions: 0
        };
      }
      titleMap[title].totalDuration += session.actualDuration;
      titleMap[title].sessions += 1;
    }

    // get the average time of all habits session and success rate
    const averageTime = sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0) / sessions.length || 0;

    const chartData = Object.values(titleMap);
    const listData = chartData.map(item => ({
      title: item.title,
      sessions: item.sessions,
      totalDuration: item.totalDuration
    }));

    const totalTime = chartData.reduce((sum, item) => sum + item.totalDuration, 0);

    res.status(200).json({
      totalTime,
      averageTime,
      successRate,
      chartData,
      listData
    });
  } catch (error) {
    console.error("Error getting detailed stats:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}

export async function getTodaysSessions(req, res) {
  try {
    const { userId } = req.params;

    // Get today's date range
    const today = getUTCDateOnly();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Fetch completed focus sessions for today
    const sessions = await FocusSession.find({
      userId,
      status: 'completed',
      startTime: { $gte: today, $lt: tomorrow }
    });

    const titleMap = {};

    // Process focus sessions
    sessions.forEach(session => {
      const title = session.title;
      if (titleMap[title]) {
        titleMap[title].totalDuration += session.actualDuration || 0;
      } else {
        titleMap[title] = {
          totalDuration: session.actualDuration || 0,
          type: session.sessionType || 'general',
          // isTask: false
        };
      }
    });

    const result = Object.entries(titleMap).map(([title, data]) => ({
      title,
      totalDuration: data.totalDuration,
      type: data.type,
    }));

    res.status(200).json({
      message: "Today's sessions and completed tasks retrieved successfully",
      sessions: result
    });
  } catch (error) {
    console.error("Error retrieving today's progress:", error);
    res.status(500).json({
      message: "Failed to retrieve today's progress",
      error: error.message
    });
  }
}

export async function getOverallConsistencyDays(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get all completed sessions since user creation
    const sessions = await FocusSession.find({
      userId,
      status: 'completed',
      startTime: { $gte: user.createdAt }
    });

    // Group sessions by date (using UTC date)
    const sessionsByDate = {};
    sessions.forEach(session => {
      // Use getUTCDateOnly ensures we strip time components correctly in UTC
      const dateStr = getUTCDateOnly(session.startTime).toISOString().split('T')[0];
      if (sessionsByDate[dateStr]) {
        sessionsByDate[dateStr]++;
      } else {
        sessionsByDate[dateStr] = 1;
      }
    });

    // Generate all days from creation to today (using UTC dates)
    const allDays = [];
    const startDate = getUTCDateOnly(user.createdAt);
    const endDate = getUTCDateOnly(); // defaults to now -> today UTC midnight

    // Iterate day by day in UTC
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const showedUp = sessionsByDate[dateStr] > 0;
      allDays.push({
        date: dateStr,
        showedUp
      });
    }

    const workingDays = allDays.filter(day => day.showedUp).length;
    const missingDays = allDays.length - workingDays;

    res.status(200).json({
      message: "Overall consistency days retrieved successfully",
      consistencyData: allDays,
      workingDays,
      missingDays
    });
  } catch (error) {
    console.error("Error retrieving overall consistency:", error);
    res.status(500).json({
      message: "Failed to retrieve overall consistency",
      error: error.message
    });
  }
}