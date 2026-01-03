import Achievement from '../models/Achivement.js';
import User from '../models/User.js';
import Habit from '../models/Habit.js';
import FocusSession from '../models/FocusSession.js';
import { ACHIEVEMENT_DEFINITIONS } from '../lib/helper.js';

export async function getUserAchievements(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Proactive checks on view
    try {
      await checkStreakAchievements(userId, user);
      await checkSessionTimeAchievements(userId);
    } catch (checkError) {
      console.error("Proactive achievement check failed:", checkError);
    }

    const userAchievements = await Achievement.find({ userId });
    console.log("User Achievements:", userAchievements);

    const achievedMap = {};
    userAchievements.forEach(a => {
      achievedMap[a.title] = a;
    });
    console.log("Achieved Map:", achievedMap);

    const inProgressByType = {};

    const fullList = [];

    for (const key in ACHIEVEMENT_DEFINITIONS) {
      const def = ACHIEVEMENT_DEFINITIONS[key];
      const type = def.type;

      if (!inProgressByType[type]) {
        inProgressByType[type] = false;
      }

      if (achievedMap[def.title]) {
        fullList.push({
          ...def,
          status: "achieved",
          dateAchieved: achievedMap[def.title].dateAchieved,
        });
      }
      else if (!inProgressByType[type]) {
        fullList.push({
          ...def,
          status: "in_progress",
        });
        inProgressByType[type] = true;
      }
      else {
        fullList.push({
          ...def,
          status: "locked",
        });
      }
    }

    return res.status(200).json({
      message: "User achievements retrieved successfully",
      achievements: fullList,
    });

  } catch (error) {
    console.error("Error retrieving user achievements:", error);
    return res.status(500).json({
      message: "Failed to retrieve user achievements",
      error: error.message,
    });
  }
}

export async function checkHabitAchievements(userId, habitId, habitObj = null) {
  const newAchievements = [];
  const habit = habitObj || await Habit.findById(habitId);
  if (!habit) return newAchievements;
  const existingAchievements = await Achievement.find({ userId, 'metadata.habitId': habit._id });
  const existingAchievementKeys = existingAchievements.map(a => a.title);
  for (const [key, definition] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    if (definition.type === 'consistency' && !existingAchievementKeys.includes(`${definition.title} - ${habit.title}`)) {
      if (habit.currentStreak >= definition.metadata.streak) {
        const achievement = new Achievement({
          userId: userId,
          title: `${definition.title} - ${habit.title}`,
          description: `${definition.description} for ${habit.title}`,
          type: definition.type,
          tier: definition.tier,
          metadata: { ...definition.metadata, habitId: habit._id }
        });
        await achievement.save();
        newAchievements.push(achievement);
      }
    }
  }
  return newAchievements;
}

export async function checkStreakAchievements(userId, userObj = null) {
  const newAchievements = [];
  const user = userObj || await User.findById(userId);
  if (!user) return newAchievements;
  const existingAchievements = await Achievement.find({ userId, type: 'streak' });
  const existingAchievementKeys = existingAchievements.map(a => a.title);
  for (const [key, definition] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    if (definition.type === 'streak' && !existingAchievementKeys.includes(definition.title)) {
      if (user.currentStreak >= definition.metadata.days) {
        const achievement = new Achievement({
          userId: userId,
          title: definition.title,
          description: definition.description,
          type: definition.type,
          tier: definition.tier,
          metadata: definition.metadata
        });
        await achievement.save();
        newAchievements.push(achievement);
      }
    }
  }
  return newAchievements;
}

export async function checkSessionTimeAchievements(userId) {
  const totalSessionMinutes = await FocusSession.aggregate([
    { $match: { userId: userId } },
    { $group: { _id: null, total: { $sum: '$actualDuration' } } }
  ]);
  const newAchievements = [];
  const existingAchievements = await Achievement.find({ userId, type: 'milestone' });
  const existingAchievementKeys = existingAchievements.map(a => a.title);
  for (const [key, definition] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    if (definition.type === 'milestone' && definition.metadata.sessions && !existingAchievementKeys.includes(definition.title)) {
      // metadata.sessions is in hours, actualDuration is in minutes
      const totalHours = (totalSessionMinutes[0]?.total || 0) / 60;
      if (totalHours >= definition.metadata.sessions) {
        const achievement = new Achievement({
          userId: userId,
          title: definition.title,
          description: definition.description,
          type: definition.type,
          tier: definition.tier,
          metadata: definition.metadata
        });
        await achievement.save();
        newAchievements.push(achievement);
      }
    }
  }
  return newAchievements;
}