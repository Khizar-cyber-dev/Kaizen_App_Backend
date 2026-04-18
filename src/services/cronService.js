// import User from '../models/User.js';
// import Habit from '../models/Habit.js';
// import Goal from '../models/Goal.js';
// import FocusSession from '../models/FocusSession.js';
// import {
//     sendGoalFailureEmail,
//     sendDailyReminderEmail,
//     sendMissedDayEmail,
//     sendWeeklyReviewEmail,
//     sendStreakMilestoneEmail
// } from '../lib/emailService.js';
// import { getUTCDateOnly, ACHIEVEMENT_DEFINITIONS } from '../lib/helper.js';

// /**
//  * Checks for goals that have expired and marks them as failed.
//  * Sends emails to affected users.
//  */
// export const checkGoalCompletion = async () => {
//     console.log('⏰ Cron: Checking goal completion...');
//     try {
//         const now = new Date();
//         const expiredGoals = await Goal.find({
//             endDate: { $lte: now },
//             status: 'active'
//         }).populate('userId');

//         // Group failed goals by user
//         const goalsByUser = {};
//         for (const goal of expiredGoals) {
//             goal.status = 'failed';
//             await goal.save();

//             const userId = goal.userId._id.toString();
//             if (!goalsByUser[userId]) {
//                 goalsByUser[userId] = {
//                     user: goal.userId,
//                     goals: []
//                 };
//             }
//             goalsByUser[userId].goals.push(goal);
//         }

//         // Send emails to users with failed goals
//         for (const userId in goalsByUser) {
//             const { user, goals } = goalsByUser[userId];
//             await sendGoalFailureEmail(user, goals);
//         }

//         console.log(`✅ Marked ${expiredGoals.length} goals as failed`);
//         return { success: true, count: expiredGoals.length };
//     } catch (error) {
//         console.error('Error in goal completion check:', error);
//         throw error;
//     }
// };

// /**
//  * Sends daily reminder emails for incomplete habits.
//  * @param {string} currentHour - The hour for which reminders are being sent (8, 12, or 20).
//  */
// export const sendDailyReminders = async (currentHour) => {
//     console.log(`Cron: Daily reminder jobs for hour ${currentHour}`);
//     try {
//         const users = await User.find({});
//         const summary = {
//             usersScanned: users.length,
//             notificationsDisabled: 0,
//             usersWithNoEmail: 0,
//             usersWithNoDailyHabits: 0,
//             usersWithNoPendingHabits: 0,
//             emailsAttempted: 0,
//             emailsSent: 0,
//             deliveryReports: [],
//             failedUsers: []
//         };

//         const today = getUTCDateOnly();
//         const tomorrow = new Date(today);
//         tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

//         for (const user of users) {
//             try {
//                 if (!user.notificationsEnabled) {
//                     summary.notificationsDisabled += 1;
//                     continue;
//                 }

//                 if (!user.email) {
//                     summary.usersWithNoEmail += 1;
//                     continue;
//                 }

//                 const habits = await Habit.find({
//                     userId: user._id,
//                     isActive: true,
//                     frequency: 'daily'
//                 });

//                 if (habits.length === 0) {
//                     summary.usersWithNoDailyHabits += 1;
//                     continue;
//                 }

//                 const todaySessions = await FocusSession.find({
//                     userId: user._id,
//                     habitId: { $ne: null },
//                     status: 'completed',
//                     startTime: { $gte: today, $lt: tomorrow }
//                 });

//                 const completedHabitIds = new Set(
//                     todaySessions.map(s => s.habitId.toString())
//                 );

//                 const incompleteHabits = habits.filter(habit =>
//                     !completedHabitIds.has(habit._id.toString())
//                 );

//                 if (incompleteHabits.length === 0) {
//                     summary.usersWithNoPendingHabits += 1;
//                     continue;
//                 }

//                 summary.emailsAttempted += 1;
//                 const result = await sendDailyReminderEmail(user, incompleteHabits, currentHour);
//                 if (result?.sent) {
//                     summary.emailsSent += 1;
//                 }
//                 summary.deliveryReports.push({
//                     userId: user._id?.toString?.() || 'unknown',
//                     email: user.email,
//                     accepted: result?.accepted || [],
//                     rejected: result?.rejected || [],
//                     response: result?.response || null,
//                     messageId: result?.messageId || null
//                 });
//             } catch (userError) {
//                 const failure = {
//                     userId: user._id?.toString?.() || 'unknown',
//                     email: user.email || 'missing-email',
//                     error: userError?.message || String(userError)
//                 };
//                 summary.failedUsers.push(failure);
//                 console.error(`Failed daily reminder for ${failure.email}:`, userError);
//             }
//         }

//         console.log(`Daily reminders processed for hour ${currentHour}`, summary);
//         return { success: true, summary };
//     } catch (error) {
//         console.error('Error in daily reminder job:', error);
//         throw error;
//     }
// };

// /**
//  * Checks for missed days and habits, updates streaks, and sends emails.
//  */
// export const checkMissedDays = async () => {
//     console.log("⏰ Cron: Checking for missed days and habits");
//     try {
//         const users = await User.find({ notificationsEnabled: true });

//         const today = getUTCDateOnly();
//         const tomorrow = new Date(today);
//         tomorrow.setDate(tomorrow.getDate() + 1);

//         for (const user of users) {
//             // 1️⃣ Check if user opened app today
//             let missedToday = true;

//             if (user.lastActive) {
//                 const lastActive = getUTCDateOnly(user.lastActive);

//                 // user opened app today
//                 if (lastActive.getTime() === today.getTime()) {
//                     missedToday = false;
//                 }
//             }

//             if (missedToday) {
//                 const lastActive = user.lastActive
//                     ? getUTCDateOnly(user.lastActive)
//                     : null;

//                 if (lastActive) {
//                     const totalMissedDays =
//                         (today - lastActive) / (1000 * 60 * 60 * 24);

//                     // ❌ reset after 2 missed days
//                     if (totalMissedDays > 2) {
//                         user.currentStreak = 0;
//                     }
//                 }

//                 await user.save();
//             }

//             // 2️⃣ Get all active daily habits
//             const habits = await Habit.find({
//                 userId: user._id,
//                 isActive: true,
//                 frequency: 'daily'
//             });

//             // 3️⃣ Check today's completed habit sessions
//             const todayHabitSessions = await FocusSession.find({
//                 userId: user._id,
//                 habitId: { $ne: null },
//                 status: 'completed',
//                 startTime: { $gte: today, $lt: tomorrow }
//             });

//             const completedHabitIds = new Set(
//                 todayHabitSessions.map(s => s.habitId.toString())
//             );

//             // 4️⃣ Find incomplete habits (not done today)
//             const missedHabits = habits.filter(habit =>
//                 !completedHabitIds.has(habit._id.toString())
//             );

//             // 5️⃣ Update missed habits: set todays_done = false and contributions level = 0
//             const todayStr = today.toISOString().split('T')[0];
//             for (const habit of missedHabits) {
//                 habit.todays_done = false;

//                 const contributionIndex = habit.contributions.findIndex(c => c.date === todayStr);
//                 if (contributionIndex >= 0) {
//                     habit.contributions[contributionIndex].level = 0;
//                 } else {
//                     habit.contributions.push({ date: todayStr, level: 0 });
//                 }

//                 const lastCompleted = habit.lastCompletedDate
//                     ? getUTCDateOnly(habit.lastCompletedDate)
//                     : null;

//                 if (!lastCompleted) continue;

//                 const daysMissed =
//                     (today - lastCompleted) / (1000 * 60 * 60 * 24);

//                 // ❄ Freeze after 1 missed day → do nothing
//                 if (daysMissed === 2) {
//                     // still frozen
//                 }

//                 // ❌ Reset after 2 missed days
//                 if (daysMissed >= 3) {
//                     habit.currentStreak = 0;
//                 }

//                 habit.todays_done = false;

//                 await habit.save();
//             }

//             // 6️⃣ Send email if user didn’t open app today OR has incomplete habits
//             if (missedToday || missedHabits.length > 0) {
//                 await sendMissedDayEmail(user, missedHabits);
//             }

//             // 7️⃣ Check for total app streak milestones
//             const milestones = Object.values(ACHIEVEMENT_DEFINITIONS)
//                 .filter(def => def.type === 'streak')
//                 .map(def => def.metadata.days);

//             if (!missedToday && milestones.includes(user.currentStreak)) {
//                 await sendStreakMilestoneEmail(user, user.currentStreak);
//             }
//         }
//         console.log("✅ Missed day check complete");
//         return { success: true };
//     } catch (error) {
//         console.error('Error in missed day check:', error);
//         throw error;
//     }
// };

// /**
//  * Sends weekly review emails.
//  */
// export const sendWeeklyReviews = async () => {
//     console.log("📊 Cron: Sending weekly reviews");
//     try {
//         const users = await User.find({ notificationsEnabled: true });

//         // Get date range for last 7 days
//         const weekAgo = new Date();
//         weekAgo.setDate(weekAgo.getDate() - 7);
//         weekAgo.setHours(0, 0, 0, 0);

//         for (const user of users) {
//             // Get user's habits
//             const habits = await Habit.find({
//                 userId: user._id,
//                 isActive: true
//             });

//             // Get sessions from last 7 days
//             const sessions = await FocusSession.find({
//                 userId: user._id,
//                 startTime: { $gte: weekAgo }
//             }).sort({ startTime: -1 });

//             // Calculate basic stats
//             const stats = {
//                 totalBreaks: 0,
//                 totalSessions: sessions.length,
//                 completedSessions: sessions.filter(s => s.status === 'completed').length
//             };

//             // Send weekly review email
//             await sendWeeklyReviewEmail(user, habits, sessions, stats);
//         }
//         console.log("✅ Weekly reviews sent");
//         return { success: true };
//     } catch (error) {
//         console.error('Error in weekly review job:', error);
//         throw error;
//     }
// };

// /**
//  * Resets todays_done for all active habits.
//  */
// export const resetDailyHabits = async () => {
//     console.log("⏰ Cron: Resetting todays_done for all habits");
//     try {
//         const today = getUTCDateOnly();
//         const habits = await Habit.find({ isActive: true });

//         for (let habit of habits) {
//             const lastCompleted = habit.lastCompletedDate ? getUTCDateOnly(habit.lastCompletedDate) : null;
//             if (!lastCompleted || lastCompleted.getTime() !== today.getTime()) {
//                 habit.todays_done = false;
//                 await habit.save();
//             }
//         }

//         console.log(`[${new Date().toISOString()}] Todays_done reset for all habits`);
//         return { success: true, count: habits.length };
//     } catch (err) {
//         console.error('Error in daily reset cron:', err);
//         throw err;
//     }
// };


// Above code is moved to workers and queues for better scalability and reliability. Cron jobs will now just add jobs to the queues, and workers will process them in parallel with retries and failure handling.

import User from '../models/User.js';
import Habit from '../models/Habit.js';
import Goal from '../models/Goal.js';
import FocusSession from '../models/FocusSession.js';
import { getUTCDateOnly, ACHIEVEMENT_DEFINITIONS } from '../lib/helper.js';
import { emailQueue } from '../queues/emailQueue.js';
import { habitQueue } from '../queues/habitQueue.js';

/**
 * Checks for goals that have expired and marks them as failed.
 * DB updates inline → email jobs queued.
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
                goalsByUser[userId] = { user: goal.userId, goals: [] };
            }
            goalsByUser[userId].goals.push(goal);
        }

        // Queue email jobs instead of sending directly
        const jobs = Object.values(goalsByUser)
            .filter(({ user }) => user.email && user.notificationsEnabled)
            .map(({ user, goals }) => ({
                name: 'goal-failure',
                data: {
                    type: 'goal-failure',
                    user: _serializeUser(user),
                    data: { goals: goals.map(g => ({ title: g.title, description: g.description, type: g.type })) }
                }
            }));

        if (jobs.length) await emailQueue.addBulk(jobs);

        console.log(`✅ Marked ${expiredGoals.length} goals as failed | 📬 ${jobs.length} emails queued`);
        return { success: true, count: expiredGoals.length, queued: jobs.length };
    } catch (error) {
        console.error('Error in goal completion check:', error);
        throw error;
    }
};

/**
 * Sends daily reminder emails for incomplete habits.
 * DB queries inline → email jobs queued.
 */
export const sendDailyReminders = async (currentHour) => {
    console.log(`⏰ Cron: Daily reminder jobs for hour ${currentHour}`);
    try {
        const users = await User.find({ notificationsEnabled: true, email: { $exists: true, $ne: '' } });

        const today = getUTCDateOnly();
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const jobs = [];
        const summary = {
            usersScanned: users.length,
            usersWithNoDailyHabits: 0,
            usersWithNoPendingHabits: 0,
            queued: 0
        };

        for (const user of users) {
            const habits = await Habit.find({ userId: user._id, isActive: true, frequency: 'daily' });
            if (!habits.length) { summary.usersWithNoDailyHabits++; continue; }

            const todaySessions = await FocusSession.find({
                userId: user._id,
                habitId: { $ne: null },
                status: 'completed',
                startTime: { $gte: today, $lt: tomorrow }
            });

            const completedHabitIds = new Set(todaySessions.map(s => s.habitId.toString()));
            const incompleteHabits = habits.filter(h => !completedHabitIds.has(h._id.toString()));

            if (!incompleteHabits.length) { summary.usersWithNoPendingHabits++; continue; }

            jobs.push({
                name: 'daily-reminder',
                data: {
                    type: 'daily-reminder',
                    user: _serializeUser(user),
                    data: {
                        incompleteHabits: incompleteHabits.map(h => ({
                            _id: h._id,
                            title: h.title,
                            currentStreak: h.currentStreak,
                            sessionMinutes: h.sessionMinutes
                        })),
                        hour: currentHour
                    }
                }
            });
        }

        if (jobs.length) await emailQueue.addBulk(jobs);

        summary.queued = jobs.length;
        console.log(`📬 Daily reminders for hour ${currentHour}:`, summary);
        return { success: true, summary };
    } catch (error) {
        console.error('Error in daily reminder job:', error);
        throw error;
    }
};

/**
 * Checks for missed days and habits, updates streaks (inline) → emails queued.
 */
export const checkMissedDays = async () => {
    console.log('⏰ Cron: Checking for missed days and habits');
    try {
        const users = await User.find({ notificationsEnabled: true });

        const today = getUTCDateOnly();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayStr = today.toISOString().split('T')[0];

        const emailJobs = [];

        for (const user of users) {
            // 1️⃣ Check if user opened app today
            let missedToday = true;
            if (user.lastActive) {
                const lastActive = getUTCDateOnly(user.lastActive);
                if (lastActive.getTime() === today.getTime()) missedToday = false;
            }

            // 2️⃣ Update user streak if missed
            if (missedToday && user.lastActive) {
                const lastActive = getUTCDateOnly(user.lastActive);
                const totalMissedDays = (today - lastActive) / (1000 * 60 * 60 * 24);
                if (totalMissedDays > 2) user.currentStreak = 0;
                await user.save();
            }

            // 3️⃣ Get all active daily habits
            const habits = await Habit.find({ userId: user._id, isActive: true, frequency: 'daily' });

            // 4️⃣ Check today's completed sessions
            const todayHabitSessions = await FocusSession.find({
                userId: user._id,
                habitId: { $ne: null },
                status: 'completed',
                startTime: { $gte: today, $lt: tomorrow }
            });

            const completedHabitIds = new Set(todayHabitSessions.map(s => s.habitId.toString()));
            const missedHabits = habits.filter(h => !completedHabitIds.has(h._id.toString()));

            // 5️⃣ Update missed habits in DB (inline — must complete before emails)
            for (const habit of missedHabits) {
                habit.todays_done = false;

                const contribIdx = habit.contributions.findIndex(c => c.date === todayStr);
                if (contribIdx >= 0) {
                    habit.contributions[contribIdx].level = 0;
                } else {
                    habit.contributions.push({ date: todayStr, level: 0 });
                }

                if (habit.lastCompletedDate) {
                    const lastCompleted = getUTCDateOnly(habit.lastCompletedDate);
                    const daysMissed = (today - lastCompleted) / (1000 * 60 * 60 * 24);
                    if (daysMissed >= 3) habit.currentStreak = 0;
                }

                await habit.save();
            }

            // 6️⃣ Queue missed day email
            if (missedToday || missedHabits.length > 0) {
                emailJobs.push({
                    name: 'missed-day',
                    data: {
                        type: 'missed-day',
                        user: _serializeUser(user),
                        data: {
                            missedHabits: missedHabits.map(h => ({
                                title: h.title,
                                currentStreak: h.currentStreak
                            }))
                        }
                    }
                });
            }

            // 7️⃣ Queue streak milestone email if earned
            const milestones = Object.values(ACHIEVEMENT_DEFINITIONS)
                .filter(def => def.type === 'streak')
                .map(def => def.metadata.days);

            if (!missedToday && milestones.includes(user.currentStreak)) {
                emailJobs.push({
                    name: 'streak-milestone',
                    data: {
                        type: 'streak-milestone',
                        user: _serializeUser(user),
                        data: { milestone: user.currentStreak }
                    }
                });
            }
        }

        if (emailJobs.length) await emailQueue.addBulk(emailJobs);

        console.log(`✅ Missed day check complete | 📬 ${emailJobs.length} emails queued`);
        return { success: true, queued: emailJobs.length };
    } catch (error) {
        console.error('Error in missed day check:', error);
        throw error;
    }
};

/**
 * Sends weekly review emails.
 * DB queries inline → email jobs queued.
 */
export const sendWeeklyReviews = async () => {
    console.log('📊 Cron: Sending weekly reviews');
    try {
        const users = await User.find({ notificationsEnabled: true, email: { $exists: true, $ne: '' } });

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        const jobs = [];

        for (const user of users) {
            const habits = await Habit.find({ userId: user._id, isActive: true });
            const sessions = await FocusSession.find({
                userId: user._id,
                startTime: { $gte: weekAgo }
            }).sort({ startTime: -1 });

            const stats = {
                totalBreaks: 0,
                totalSessions: sessions.length,
                completedSessions: sessions.filter(s => s.status === 'completed').length
            };

            jobs.push({
                name: 'weekly-review',
                data: {
                    type: 'weekly-review',
                    user: _serializeUser(user),
                    data: {
                        habits: habits.map(h => ({
                            title: h.title,
                            currentStreak: h.currentStreak,
                            successRate: h.successRate,
                            totalSessionsCompleted: h.totalSessionsCompleted
                        })),
                        sessions: sessions.map(s => ({
                            status: s.status,
                            startTime: s.startTime,
                            actualDuration: s.actualDuration,
                            rating: s.rating
                        })),
                        stats
                    }
                }
            });
        }

        if (jobs.length) await emailQueue.addBulk(jobs);

        console.log(`✅ Weekly reviews | 📬 ${jobs.length} emails queued`);
        return { success: true, queued: jobs.length };
    } catch (error) {
        console.error('Error in weekly review job:', error);
        throw error;
    }
};

/**
 * Resets todays_done — queued as parallel DB jobs via habitQueue.
 */
export const resetDailyHabits = async () => {
    console.log('⏰ Cron: Resetting todays_done for all habits');
    try {
        const today = getUTCDateOnly();
        const habits = await Habit.find({ isActive: true }, '_id lastCompletedDate');

        const jobs = habits
            .filter(habit => {
                const lastCompleted = habit.lastCompletedDate ? getUTCDateOnly(habit.lastCompletedDate) : null;
                return !lastCompleted || lastCompleted.getTime() !== today.getTime();
            })
            .map(habit => ({
                name: 'reset-habit',
                data: { habitId: habit._id.toString() }
            }));

        if (jobs.length) await habitQueue.addBulk(jobs);

        console.log(`📬 ${jobs.length} habit reset jobs queued`);
        return { success: true, queued: jobs.length };
    } catch (err) {
        console.error('Error in daily reset cron:', err);
        throw err;
    }
};

// ─── Helper ───────────────────────────────────────────────────────────────────
// Only pass plain data to queue — no Mongoose documents
const _serializeUser = (user) => ({
    _id: user._id?.toString(),
    email: user.email,
    name: user.name,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    notificationsEnabled: user.notificationsEnabled
});