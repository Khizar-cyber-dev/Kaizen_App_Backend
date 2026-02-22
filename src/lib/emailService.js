import { groq } from '../config/groq.js';
import transporter from '../config/nodeMailer.js';

export async function generateEmailContent(prompt) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `
            You are an email assistant.
            Return ONLY valid JSON in this format:

            {
              "subject": "Email subject",
              "html": "<p>Email body in HTML</p>"
            }

            Prompt:
            ${prompt}
          `,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 1,
      response_format: { type: "json_object" },
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    return JSON.parse(text);

  } catch (error) {
    console.error("Email AI Error:", error);
    return null;
  }
}


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
          <h1>📊 Kizen Productivity</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Keep pushing forward! Every step counts.</p>
          <p><strong>The Kizen Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send a coaching-style welcome email for new users
 */
export const sendWelcomeEmail = async (user) => {
  try {
    if (!user.email) return;

    const prompt = `
      You are a high-performance personal growth coach welcoming a new user to "Kizen".
      The name "Kizen" is inspired by the philosophy of continuous improvement (Kaizen).
      
      User: ${user.name}
      
      Create a welcoming and electric message that:
      1. Celebrates their decision to join the 1% of people who take their growth seriously.
      2. Briefly explains that Kizen is their partner in building discipline, not just another habit tracker.
      3. Sets a "No Shame" policy: Setbacks are data, not failures.
      4. Gives 1 short "Day 1 Hack" for consistency.
      5. Invites them to start their first focus session today.
      
      The tone should be energetic, inspiring, and professional.
      
      Return JSON format:
      {
        "subject": "Email subject (Electric & Welcoming)",
        "html": "HTML content with the welcome coaching message"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      emailContent = {
        subject: `Welcome to Kizen, ${user.name}! 🚀`,
        html: `<h2>The Journey Begins!</h2><p>Welcome to Kizen. We're here to help you turn your potential into performance. Ready to start your first session?</p>`
      };
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome coaching email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

/**
 * Send goal failure email
 */
export const sendGoalFailureEmail = async (user, goals) => {
  try {
    if (!user.email || !user.notificationsEnabled) return;

    const prompt = `
      You are a high-performance personal growth coach who deeply cares about the user's journey.
      A user's goals have reached their deadline without being completed.
      
      User: ${user.name}
      Failed Goals:
      ${goals.map(g => `- ${g.title}: ${g.description || 'No description'}`).join('\n')}
      
      Create a deeply compassionate and motivating message.
      - DO NOT use corporate or cold language.
      - Acknowledge that life happens and setbacks are just data for the next attempt.
      - Remind them that the "Kizen" community (the app) still believes in their potential.
      - Encourage them to "Review, Refine, and Restart".
      - Give 1 small, actionable tip on how to break down a big goal next time.
      
      Return JSON format:
      {
        "subject": "Email subject (Warm & Encouraging)",
        "html": "HTML content with the coaching message"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      // Fallback template
      emailContent = {
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
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
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
      You are a supportive accountability partner. 
      The user hasn't finished some of their habits yet for today.
      
      User: ${user.name}
      Time of Day: ${timeLabels[timeOfDay]}
      Incomplete Habits Today:
      ${incompleteHabits.map(h => `- ${h.title} (Current Streak: ${h.currentStreak} days)`).join('\n')}
      
      Create a warm and motivating reminder that:
      1. Uses a "Win the ${timeLabels[timeOfDay]}" theme to keep it fresh and relevant.
      2. Gently nudges them to take action without being pushy or robotic.
      3. Mentions that staying consistent with their habits is how they build the person they want to become.
      4. Provides 1 tiny piece of advice to overcome friction (e.g., "Just do 2 minutes", "Set a timer for 5 mins", or "Start with the easiest task").
      
      Return JSON format:
      {
        "subject": "Subject (Upbeat, motivating, and time-aware)",
        "html": "HTML content with the supportive reminder"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      // Fallback template
      emailContent = {
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
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
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
      You are a compassionate coach reaching out because the user missed a day or missed some habits. 
      The tone should be: "We missed you, and we're here to help you get back into the flow."
      
      User: ${user.name}
      Current Streak: ${user.currentStreak} days
      Missed Habits:
      ${missedHabits.length > 0 ? missedHabits.map(h => `- ${h.title}`).join('\n') : 'The user didn\'t check in at all today.'}
      
      Guidelines:
      1. Normalize the lapse. Remind them that perfection is not the goal—consistency is.
      2. Remind them that "Never Miss Twice" is the golden rule of habit formation.
      3. Be highly supportive and non-judgmental. No "guilt-tripping".
      4. Invite them back for a fresh start tomorrow. Share a tiny tip for a "easy win" tomorrow.
      
      Return JSON format:
      {
        "subject": "Subject (Supportive, welcoming, and low-pressure)",
        "html": "HTML content with the comforting message"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      // Fallback template
      emailContent = {
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
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
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
 * Send weekly review email using AI
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
      You are a high-performance productivity analyst and coach.
      Generate a comprehensive weekly review email that feels like a premium, personalized performance report.
      
      USER PERFORMANCE DATA (Last 7 Days):
      - Name: ${user.name}
      - Total Sessions Completed: ${recentSessions.length}
      - Avg Session Duration: ${avgDuration} minutes
      - Avg Focus Rating: ${avgRating}/5
      - Abandoned Sessions: ${recentSessions.filter(s => s.status === 'abandoned').length}
      - Habit Statistics: ${habits.map(h => `${h.title}: ${h.successRate.toFixed(0)}% completion`).join(', ')}
      
      Your review must include:
      1. "The Big Picture": A warm celebration of their momentum and showing up.
      2. "Celebrate the Wins": Specifically highlight their best performing habit or focus session.
      3. "The Growth Gap (Coaching Tips)": Identify where they struggled (e.g., abandoned sessions, low completion rates) and provide 2 specific, actionable coaching tips to overcome these "lacks".
      4. "Your Mission for Next Week": Give them 1 clear focus area or a small challenge to aim for.
      
      The tone must be professional yet deeply caring, showing that the app is truly invested in their growth. Use rich HTML formatting.
      
      Return JSON format:
      {
        "subject": "Weekly Review: [Provide a Motivating or Insightful Headline]",
        "html": "Rich HTML content for the weekly review"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      // Fallback template
      const topHabit = habits.length > 0 ? habits.reduce((a, b) => a.currentStreak > b.currentStreak ? a : b) : null;
      emailContent = {
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
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
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

/**
 * Send streak milestone celebration email
 */
export const sendStreakMilestoneEmail = async (user, milestone) => {
  try {
    if (!user.email || !user.notificationsEnabled) return;

    const prompt = `
      You are a high-energy celebration assistant! A user just hit a major consistency milestone.
      
      User: ${user.name}
      Milestone: ${milestone} days of total app consistency
      
      Create a vibrant and celebratory email that:
      1. Throws a "digital party" for their incredible discipline.
      2. Reminds them that they are now in the elite tier of focused users.
      3. Encourages them toward the next milestone.
      4. Expresses how proud the "Kizen" community is of their persistent growth.
      
      Return JSON format:
      {
        "subject": "Subject (High energy, celebratory, and acknowledging their power)",
        "html": "HTML content that feels like a reward/celebration"
      }
    `;

    let emailContent = await generateEmailContent(prompt);

    if (!emailContent) {
      emailContent = {
        subject: `🔥 Incredible! You've reached a ${milestone}-Day Streak!`,
        html: `<h2>Unstoppable, ${user.name}!</h2><p>You have maintained your streak for <strong>${milestone} days</strong>. That level of discipline is what separates the dreamers from the achievers. keep that flame burning bright! 🚀</p>`
      };
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'noreply@kizen.com',
      to: user.email,
      subject: emailContent.subject,
      html: getEmailTemplate(emailContent.subject, emailContent.html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Streak milestone email sent to ${user.email} for ${milestone} days`);
  } catch (error) {
    console.error('Error sending streak milestone email:', error);
  }
};
