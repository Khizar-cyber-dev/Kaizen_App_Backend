import User from '../models/User.js';
import Habit from '../models/Habit.js';
import Goal from '../models/Goal.js';
import FocusSession from '../models/FocusSession.js';
import {
    sendGoalFailureEmail,
    sendDailyReminderEmail,
    sendMissedDayEmail,
    sendWeeklyReviewEmail,
    sendStreakMilestoneEmail
} from '../lib/emailService.js';
import { getUTCDateOnly, ACHIEVEMENT_DEFINITIONS } from '../lib/helper.js';

/**
 * Checks for goals that have expired and marks them as failed.
 * Sends emails to affected users.
 */
export const checkGoalCompletion = async () => {
    console.log('⏰ Cron: Checking goal completion...');
    try {
        const now = new Date();
        const expiredGoals = await Goal.find({
            endDate: { $lte: now },
            status: 'active'
        }).populate('userId');

        // Group failed goals by user
        const goalsByUser = {};
        for (const goal of expiredGoals) {
            goal.status = 'failed';
            await goal.save();

            const userId = goal.userId._id.toString();
            if (!goalsByUser[userId]) {
                goalsByUser[userId] = {
                    user: goal.userId,
                    goals: []
                };
            }
            goalsByUser[userId].goals.push(goal);
        }

        // Send emails to users with failed goals
        for (const userId in goalsByUser) {
            const { user, goals } = goalsByUser[userId];
            await sendGoalFailureEmail(user, goals);
        }

        console.log(`✅ Marked ${expiredGoals.length} goals as failed`);
        return { success: true, count: expiredGoals.length };
    } catch (error) {
        console.error('Error in goal completion check:', error);
        throw error;
    }
};

/**
 * Sends daily reminder emails for incomplete habits.
 * @param {string} currentHour - The hour for which reminders are being sent (8, 12, or 20).
 */
export const sendDailyReminders = async (currentHour) => {
    console.log(`⏰ Cron: Daily reminder jobs for hour ${currentHour}`);
    try {
        const users = await User.find({ notificationsEnabled: true });

        for (const user of users) {
            // Get all active habits for the user
            const habits = await Habit.find({
                userId: user._id,
                isActive: true,
                frequency: 'daily'
            });

            // Get today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get today's completed sessions for habits
            const todaySessions = await FocusSession.find({
                userId: user._id,
                habitId: { $ne: null },
                status: 'completed',
                startTime: { $gte: today, $lt: tomorrow }
            });

            const completedHabitIds = new Set(
                todaySessions.map(s => s.habitId.toString())
            );

            // Find incomplete habits (not completed today)
            const incompleteHabits = habits.filter(habit =>
                !completedHabitIds.has(habit._id.toString())
            );

            // Send reminder email if there are incomplete habits
            if (incompleteHabits.length > 0) {
                await sendDailyReminderEmail(user, incompleteHabits, currentHour);
            }
        }
        console.log(`✅ Daily reminders processed for hour ${currentHour}`);
        return { success: true };
    } catch (error) {
        console.error('Error in daily reminder job:', error);
        throw error;
    }
};

/**
 * Checks for missed days and habits, updates streaks, and sends emails.
 */
export const checkMissedDays = async () => {
    console.log("⏰ Cron: Checking for missed days and habits");
    try {
        const users = await User.find({ notificationsEnabled: true });

        const today = getUTCDateOnly();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        for (const user of users) {
            // 1️⃣ Check if user opened app today
            let missedToday = true;

            if (user.lastActive) {
                const lastActive = getUTCDateOnly(user.lastActive);

                // user opened app today
                if (lastActive.getTime() === today.getTime()) {
                    missedToday = false;
                }
            }

            if (missedToday) {
                // ✅ count ONLY 1 missed day per cron
                user.missingDays += 1;

                const lastActive = user.lastActive
                    ? getUTCDateOnly(user.lastActive)
                    : null;

                if (lastActive) {
                    const totalMissedDays =
                        (today - lastActive) / (1000 * 60 * 60 * 24);

                    // ❌ reset after 2 missed days
                    if (totalMissedDays > 2) {
                        user.currentStreak = 0;
                    }
                }

                await user.save();
            }

            // 2️⃣ Get all active daily habits
            const habits = await Habit.find({
                userId: user._id,
                isActive: true,
                frequency: 'daily'
            });

            // 3️⃣ Check today's completed habit sessions
            const todayHabitSessions = await FocusSession.find({
                userId: user._id,
                habitId: { $ne: null },
                status: 'completed',
                startTime: { $gte: today, $lt: tomorrow }
            });

            const completedHabitIds = new Set(
                todayHabitSessions.map(s => s.habitId.toString())
            );

            // 4️⃣ Find incomplete habits (not done today)
            const missedHabits = habits.filter(habit =>
                !completedHabitIds.has(habit._id.toString())
            );

            // 5️⃣ Update missed habits: set todays_done = false and contributions level = 0
            const todayStr = today.toISOString().split('T')[0];
            for (const habit of missedHabits) {
                habit.todays_done = false;

                const contributionIndex = habit.contributions.findIndex(c => c.date === todayStr);
                if (contributionIndex >= 0) {
                    habit.contributions[contributionIndex].level = 0;
                } else {
                    habit.contributions.push({ date: todayStr, level: 0 });
                }

                const lastCompleted = habit.lastCompletedDate
                    ? getUTCDateOnly(habit.lastCompletedDate)
                    : null;

                if (!lastCompleted) continue;

                const daysMissed =
                    (today - lastCompleted) / (1000 * 60 * 60 * 24);

                // ❄ Freeze after 1 missed day → do nothing
                if (daysMissed === 2) {
                    // still frozen
                }

                // ❌ Reset after 2 missed days
                if (daysMissed >= 3) {
                    habit.currentStreak = 0;
                }

                habit.todays_done = false;

                await habit.save();
            }

            // 6️⃣ Send email if user didn’t open app today OR has incomplete habits
            if (missedToday || missedHabits.length > 0) {
                await sendMissedDayEmail(user, missedHabits);
            }

            // 7️⃣ Check for total app streak milestones
            const milestones = Object.values(ACHIEVEMENT_DEFINITIONS)
                .filter(def => def.type === 'streak')
                .map(def => def.metadata.days);

            if (!missedToday && milestones.includes(user.currentStreak)) {
                await sendStreakMilestoneEmail(user, user.currentStreak);
            }
        }
        console.log("✅ Missed day check complete");
        return { success: true };
    } catch (error) {
        console.error('Error in missed day check:', error);
        throw error;
    }
};

/**
 * Sends weekly review emails.
 */
export const sendWeeklyReviews = async () => {
    console.log("📊 Cron: Sending weekly reviews");
    try {
        const users = await User.find({ notificationsEnabled: true });

        // Get date range for last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        for (const user of users) {
            // Get user's habits
            const habits = await Habit.find({
                userId: user._id,
                isActive: true
            });

            // Get sessions from last 7 days
            const sessions = await FocusSession.find({
                userId: user._id,
                startTime: { $gte: weekAgo }
            }).sort({ startTime: -1 });

            // Calculate basic stats
            const stats = {
                totalBreaks: 0,
                totalSessions: sessions.length,
                completedSessions: sessions.filter(s => s.status === 'completed').length
            };

            // Send weekly review email
            await sendWeeklyReviewEmail(user, habits, sessions, stats);
        }
        console.log("✅ Weekly reviews sent");
        return { success: true };
    } catch (error) {
        console.error('Error in weekly review job:', error);
        throw error;
    }
};

/**
 * Resets todays_done for all active habits.
 */
export const resetDailyHabits = async () => {
    console.log("⏰ Cron: Resetting todays_done for all habits");
    try {
        const today = getUTCDateOnly();
        const habits = await Habit.find({ isActive: true });

        for (let habit of habits) {
            const lastCompleted = habit.lastCompletedDate ? getUTCDateOnly(habit.lastCompletedDate) : null;
            if (!lastCompleted || lastCompleted.getTime() !== today.getTime()) {
                habit.todays_done = false;
                await habit.save();
            }
        }

        console.log(`[${new Date().toISOString()}] Todays_done reset for all habits`);
        return { success: true, count: habits.length };
    } catch (err) {
        console.error('Error in daily reset cron:', err);
        throw err;
    }
};
