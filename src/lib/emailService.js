import transporter from '../config/nodeMailer.js';
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// export async function generateEmailContent(prompt) {
//   try {
//     const { text } = await generateText({
//       model: google("gemini-2.0-flash-001"),
//       prompt: `
//         You are an email assistant.
//         Return ONLY valid JSON in this format:

//         {
//           "subject": "Email subject",
//           "html": "<p>Email body in HTML</p>"
//         }

//         Prompt:
//         ${prompt}
//               `,
//     });

//     // Parse strict JSON
//     return JSON.parse(text);

//   } catch (error) {
//     console.error("Email AI Error:", error);
//     return {
//       subject: "Productivity Update",
//       html: "<p>Keep going. You're doing great.</p>",
//     };
//   }
// }


/**
 * Base email template wrapper
 */
const getEmailTemplate = (subject, content) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #4F46E5;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #4F46E5;
          margin: 0;
          font-size: 24px;
        }
        .content {
          margin: 20px 0;
        }
        .habit-list {
          list-style: none;
          padding: 0;
          margin: 20px 0;
        }
        .habit-item {
          background-color: #f8f9fa;
          padding: 15px;
          margin: 10px 0;
          border-radius: 5px;
          border-left: 4px solid #4F46E5;
        }
        .habit-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }
        .streak-info {
          color: #666;
          font-size: 14px;
        }
        .goal-item {
          background-color: #fee;
          padding: 15px;
          margin: 10px 0;
          border-radius: 5px;
          border-left: 4px solid #dc3545;
        }
        .goal-title {
          font-weight: bold;
          color: #dc3545;
          margin-bottom: 5px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #4F46E5;
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .highlight {
          background-color: #fff3cd;
          padding: 15px;
          border-radius: 5px;
          border-left: 4px solid #ffc107;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 DeathWalk Productivity</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Keep pushing forward! Every step counts.</p>
          <p><strong>The DeathWalk Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send goal failure email
 */
export const sendGoalFailureEmail = async (user, goals) => {
  try {
    if (!user.email || !user.notificationsEnabled) return;

    const prompt = `
      Generate a compassionate email notification for a user whose goals have failed.
      
      User: ${user.name}
      Failed Goals:
      ${goals.map(g => `- ${g.title}: ${g.description || 'No description'}, Type: ${g.type}, End Date: ${new Date(g.endDate).toLocaleDateString()}`).join('\n')}
      
      Create a motivating message that:
      1. Acknowledges the failure without being harsh
      2. Encourages the user to set new goals
      3. Suggests learning from the experience
      4. Motivates them to keep going
      
      Return JSON format:
      {
        "subject": "Email subject (max 60 chars)",
        "html": "HTML content with motivational message"
      }
    `;

    //let emailContent = await generateEmailContent(prompt);

    //    if (!emailContent) {
    // Fallback template
    const emailContent = {
      subject: 'Goals Update - Time to Reflect',
      html: `
          <h2>Hello ${user.name},</h2>
          <p>We noticed that some of your goals have reached their deadline without completion:</p>
          <ul>
            ${goals.map(g => `<li><strong>${g.title}</strong> - ${g.type} goal</li>`).join('')}
          </ul>
          <div class="highlight">
            <p><strong>Remember:</strong> Setbacks are part of the journey. Use this as a learning opportunity to set new, achievable goals.</p>
          </div>
          <p>Don't give up! Let's create new goals and keep moving forward. 💪</p>
        `
    };
    //    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@deathwalk.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Goal failure email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending goal failure email:', error);
  }
};

/**
 * Send daily reminder email for incomplete habits (8am, 12pm, 8pm)
 */
export const sendDailyReminderEmail = async (user, incompleteHabits, timeOfDay) => {
  try {
    if (!user.email || !user.notificationsEnabled || incompleteHabits.length === 0) return;

    const timeLabels = {
      '8': 'Morning',
      '12': 'Afternoon',
      '20': 'Evening'
    };

    const prompt = `
      Generate a friendly reminder email for a user about incomplete habits.
      
      User: ${user.name}
      Current Streak: ${user.currentStreak} days
      Time of Day: ${timeLabels[timeOfDay]}
      Incomplete Habits Today:
      ${incompleteHabits.map(h => `- ${h.title}: ${h.currentStreak} day streak, Target: ${h.sessionMinutes} minutes`).join('\n')}
      
      Create a motivating reminder that:
      1. Is appropriate for the time of day (morning/afternoon/evening)
      2. Gently reminds about incomplete habits
      3. Motivates without being pushy
      4. Emphasizes maintaining the streak
      
      Return JSON format:
      {
        "subject": "Email subject (max 60 chars)",
        "html": "HTML content with reminder message"
      }
    `;

    // let emailContent = await generateEmailContent(prompt);

    //    if (!emailContent) {
    // Fallback template
    const emailContent = {
      subject: `${timeLabels[timeOfDay]} Reminder - Complete Your Habits`,
      html: `
          <h2>Hello ${user.name},</h2>
          <p>Good ${timeLabels[timeOfDay].toLowerCase()}! Don't forget to complete your habits today to maintain your ${user.currentStreak}-day streak! 🔥</p>
          <p><strong>Habits still pending today:</strong></p>
          <ul class="habit-list">
            ${incompleteHabits.map(h => `
              <li class="habit-item">
                <div class="habit-title">${h.title}</div>
                <div class="streak-info">Current streak: ${h.currentStreak} days${h.sessionMinutes ? ` | Target: ${h.sessionMinutes} minutes` : ''}</div>
              </li>
            `).join('')}
          </ul>
          <p>You've got this! Keep your momentum going. 💪</p>
        `
    };
    //    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@deathwalk.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Daily reminder email sent to ${user.email} at ${timeLabels[timeOfDay]}`);
  } catch (error) {
    console.error('Error sending daily reminder email:', error);
  }
};

/**
 * Send midnight reminder for missed day/habits
 */
export const sendMissedDayEmail = async (user, missedHabits) => {
  try {
    if (!user.email || !user.notificationsEnabled) return;

    const prompt = `
      Generate a supportive email for a user who missed completing habits today or didn't use the app.
      
      User: ${user.name}
      Current Streak: ${user.currentStreak} days
      Longest Streak: ${user.longestStreak} days
      Missed Habits Today:
      ${missedHabits.length > 0 ? missedHabits.map(h => `- ${h.title}: ${h.currentStreak} day streak at risk`).join('\n') : 'No specific habits missed (user did not use app)'}
      
      Create a message that:
      1. Gently reminds about the missed day
      2. Encourages them to come back tomorrow to not break their streak
      3. Is supportive and non-judgmental
      4. Motivates them to get back on track
      
      Return JSON format:
      {
        "subject": "Email subject (max 60 chars)",
        "html": "HTML content with supportive message"
      }
    `;

    //    let emailContent = await generateEmailContent(prompt);

    //    if (!emailContent) {
    // Fallback template
    const emailContent = {
      subject: 'Don\'t Break Your Streak - Come Back Tomorrow!',
      html: `
          <h2>Hello ${user.name},</h2>
          <div class="highlight">
            <p><strong>You missed today, but don't worry!</strong> Tomorrow is a fresh start. Come back to keep your ${user.currentStreak}-day streak alive! 🔥</p>
          </div>
          ${missedHabits.length > 0 ? `
            <p><strong>Habits that were missed today:</strong></p>
            <ul class="habit-list">
              ${missedHabits.map(h => `
                <li class="habit-item">
                  <div class="habit-title">${h.title}</div>
                  <div class="streak-info">Current streak of ${h.title}: ${h.currentStreak} days - Don't let it break!</div>
                </li>
              `).join('')}
            </ul>
          ` : '<p>We noticed you didn\'t use the app today. Make sure to come back tomorrow to maintain your progress!</p>'}
          <p><strong>Your Stats:</strong></p>
          <ul>
            <li>Current Streak: ${user.currentStreak} days</li>
            <li>Longest Streak: ${user.longestStreak} days</li>
          </ul>
          <p>Tomorrow is your chance to get back on track. You've got this! 💪</p>
        `
    };
    //    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@deathwalk.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Missed day email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending missed day email:', error);
  }
};

/**
 * Send weekly review email using Gemini
 */
export const sendWeeklyReviewEmail = async (user, habits, sessions, stats) => {
  try {
    if (!user.email || !user.notificationsEnabled) return;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentSessions = sessions.filter(s => new Date(s.startTime) >= weekAgo);
    const avgDuration = recentSessions.length > 0
      ? Math.round(recentSessions.reduce((a, b) => a + (b.actualDuration || 0), 0) / recentSessions.length)
      : 0;
    const avgRating = recentSessions.length > 0 && recentSessions.some(s => s.rating)
      ? (recentSessions.reduce((a, b) => a + (b.rating || 0), 0) / recentSessions.filter(s => s.rating).length).toFixed(1)
      : 0;

    const prompt = `
      Generate a comprehensive weekly review email for a productivity app user.
      
      USER PROFILE:
      - Name: ${user.name}
      - Current Streak: ${user.currentStreak} days
      - Longest Streak: ${user.longestStreak} days
      - Total Sessions (all time): ${user.totalSessions}
      
      WEEKLY PERFORMANCE (last 7 days):
      - Sessions Completed: ${recentSessions.length}
      - Average Duration: ${avgDuration} minutes
      - Average Focus Rating: ${avgRating}/5
      - Abandoned Sessions: ${recentSessions.filter(s => s.status === 'abandoned').length}
      
      HABITS PERFORMANCE:
      ${habits.map(h => `
        • ${h.title}: 
          - Current Streak: ${h.currentStreak} days
          - Longest Streak: ${h.longestStreak} days
          - Total Sessions: ${h.totalSessionsCompleted}
          - Success Rate: ${h.successRate.toFixed(1)}%
          - Average Session Time: ${Math.round(h.averageSessionTime)} minutes
      `).join('')}
      
      Create a comprehensive weekly review that includes:
      1. A warm greeting and celebration of achievements
      2. Key highlights from the week (best performances)
      3. Areas for improvement (habits with low streaks, missed sessions)
      4. Personalized tips for the coming week based on patterns
      5. Motivational closing message
      
      Make it engaging, personalized, and actionable. Use HTML formatting with paragraphs, lists, and emphasis.
      
      Return JSON format:
      {
        "subject": "Email subject (max 70 chars)",
        "html": "Rich HTML content with the weekly review"
      }
    `;

    //    let emailContent = await generateEmailContent(prompt);

    //    if (!emailContent) {
    // Fallback template
    const topHabit = habits.length > 0 ? habits.reduce((a, b) => a.currentStreak > b.currentStreak ? a : b) : null;
    const emailContent = {
      subject: `Weekly Review - ${user.name}'s Progress`,
      html: `
          <h2>Hello ${user.name}! 👋</h2>
          <p>Here's your weekly productivity review:</p>
          
          <div class="highlight">
            <h3>📊 This Week's Highlights</h3>
            <ul>
              <li>Total Sessions: ${recentSessions.length}</li>
              <li>Average Duration: ${avgDuration} minutes</li>
              <li>Current Streak: ${user.currentStreak} days 🔥</li>
              ${topHabit ? `<li>Best Performing Habit: ${topHabit.title} (${topHabit.currentStreak} day streak)</li>` : ''}
            </ul>
          </div>
          
          <h3>🎯 Habit Performance</h3>
          <ul class="habit-list">
            ${habits.map(h => `
              <li class="habit-item">
                <div class="habit-title">${h.title}</div>
                <div class="streak-info">
                  Streak: ${h.currentStreak} days | Success Rate: ${h.successRate.toFixed(1)}% | Sessions: ${h.totalSessionsCompleted}
                </div>
              </li>
            `).join('')}
          </ul>
          
          <p><strong>Keep up the great work!</strong> Every session brings you closer to your goals. 💪</p>
        `
    };
    //    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@deathwalk.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Weekly review email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending weekly review email:', error);
  }
};

