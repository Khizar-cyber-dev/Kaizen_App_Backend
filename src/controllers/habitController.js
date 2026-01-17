import Habit from "../models/Habit.js";
import FocusSession from "../models/FocusSession.js";
import { getUTCDateOnly, calculateHabitTier } from "../lib/helper.js";
import { checkHabitAchievements } from "./achievementController.js";

export async function createHabit(req, res) {
  try {
    const { userId, title, description, sessionMinutes, frequency, targetDaysPerWeek, color, icon } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ message: 'userId and title are required' });
    }
    const isSessionHabit = sessionMinutes && sessionMinutes > 0;
    const newHabit = new Habit({
      userId,
      title,
      description,
      sessionMinutes: isSessionHabit ? sessionMinutes : undefined,
      frequency: frequency || 'daily',
      type: isSessionHabit ? 'session' : 'task',
      targetDaysPerWeek: targetDaysPerWeek || 7,
      color: color || "#4F46E5",
      icon: icon || null,
      isActive: true,
    });

    await newHabit.save();

    res.status(201).json({
      message: 'Habit created successfully',
      habit: newHabit
    });
  } catch (error) {
    console.error('Error creating habit:', error);
    res.status(500).json({
      message: 'Failed to create habit',
      error: error.message
    });
  }
}

export async function getHabits(req, res) {
  try {
    const { userId } = req.params;
    const habits = await Habit.find({ userId, isActive: true });

    const todayUTC = getUTCDateOnly();
    const responseHabits = [];


    for (let habit of habits) {

      // Lazy Reset: If cron missed (dev env), reset todays_done if lastCompletedDate is not today
      const lastCompleted = habit.lastCompletedDate ? getUTCDateOnly(habit.lastCompletedDate) : null;
      if (habit.todays_done && (!lastCompleted || lastCompleted.getTime() !== todayUTC.getTime())) {
        habit.todays_done = false;
        await habit.save();
      }

      // Check for any active (in_progress) or abandoned sessions for this habit TODAY
      let activeSessionId = null;
      if (habit.type === 'session') {
        // Find *active* or *recently abandoned today* session
        const startOfToday = new Date(todayUTC);
        startOfToday.setUTCHours(0, 0, 0, 0);

        const activeSession = await FocusSession.findOne({
          habitId: habit._id,
          userId: habit.userId,
          startTime: { $gte: startOfToday },
          status: { $in: ['in_progress', 'abandoned'] } // Allow resuming abandoned sessions too
        }).sort({ startTime: -1 }); // Get the latest one

        if (activeSession) {
          activeSessionId = activeSession._id;
          console.log(`[DEBUG] Found active session: ${activeSessionId} for habit ${habit.title}`);
        } else {
          console.log(`[DEBUG] No active session found for habit ${habit.title} on ${startOfToday}`);
        }

      }

      const dateMap = {};
      habit.completionDates.forEach(entry => {
        const dateStr = getUTCDateOnly(entry.date).toISOString().split('T')[0];
        dateMap[dateStr] = entry.completed ? 2 : 1;
      });

      const contributions = [];
      // Limit history to last 365 days to ensure scalability and reduce payload size
      // The frontend only displays ~84 days (12 weeks) anyway
      const oneYearAgo = new Date(todayUTC);
      oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365);

      const createdAtDate = getUTCDateOnly(habit.createdAt);
      const startDate = createdAtDate > oneYearAgo ? createdAtDate : oneYearAgo;
      const endDate = todayUTC;

      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = getUTCDateOnly(d).toISOString().split('T')[0];
        let level = dateMap[dateStr] || 0;

        // If today, and not completed (level 2), check if started
        if (habit.type === 'session' &&
          dateStr === todayUTC.toISOString().split('T')[0] &&
          level !== 2) {

          if (activeSessionId) {
            level = 1;
          }
        }

        contributions.push({ date: dateStr, level });
      }

      habit.contributions = contributions;
      // await habit.save(); // Removed to prevent VersionError on concurrent reads/writes

      let newAchievements = [];
      try {
        newAchievements = await checkHabitAchievements(habit.userId, habit._id, habit);
      } catch (e) { console.error('Achievement check failed:', e); }

      // Active session logic moved up

      responseHabits.push({
        _id: habit._id,
        title: habit.title,
        description: habit.description,
        color: habit.color,
        icon: habit.icon,
        type: habit.type,
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
        tier: calculateHabitTier(habit),
        contributions,
        sessionMinutes: habit.sessionMinutes,
        newAchievements: newAchievements.length > 0 ? newAchievements : undefined,
        activeSessionId
      });
    }

    return res.status(200).json({ message: 'Habits retrieved successfully', habits: responseHabits });

  } catch (error) {
    console.error('Error retrieving habits:', error);
    return res.status(500).json({ message: 'Failed to retrieve habits', error: error.message });
  }
}

export async function deleteHabit(req, res) {
  try {
    const { habitId } = req.params;
    const habit = await Habit.findById(habitId);

    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    // Soft delete by marking as inactive
    habit.isActive = false;
    await habit.save();

    res.status(200).json({
      message: 'Habit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting habit:', error);
    res.status(500).json({
      message: 'Failed to delete habit',
      error: error.message
    });
  }
}

export async function updateHabit(req, res) {
  try {
    const { habitId } = req.params;
    const {
      title,
      description,
      sessionMinutes,
      frequency,
      targetDaysPerWeek,
      color,
      icon
    } = req.body;

    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    habit.title = title ?? habit.title;
    habit.description = description ?? habit.description;
    habit.frequency = frequency ?? habit.frequency;
    habit.targetDaysPerWeek = targetDaysPerWeek ?? habit.targetDaysPerWeek;
    habit.color = color ?? habit.color;
    habit.icon = icon ?? habit.icon;

    if (sessionMinutes !== undefined) {
      if (sessionMinutes > 0) {
        habit.sessionMinutes = sessionMinutes;
        habit.type = 'session';
      } else {
        habit.sessionMinutes = undefined;
        habit.type = 'task';
      }
    }

    await habit.save();

    res.status(200).json({
      message: 'Habit updated successfully',
      habit
    });

  } catch (error) {
    console.error('Error updating habit:', error);
    res.status(500).json({
      message: 'Failed to update habit',
      error: error.message
    });
  }
}