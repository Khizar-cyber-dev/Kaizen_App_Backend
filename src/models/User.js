import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { getUTCDateOnly } from "../lib/helper.js";
import { checkStreakAchievements } from "../controllers/achievementController.js";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.clerkId;
    },
  },
  clerkId: {
    type: String,
    unique: true,
    sparse: true,
  },
  lastActive: {
    type: Date,
    default: null,
  },
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
  nextSessionNumber: {
    type: Number,
    default: 1,
  },
  missingDays: {
    type: Number,
    default: 0,
  },
  notificationsEnabled: {
    type: Boolean,
    default: true,
  },
  lastNotificationSent: {
    type: Date,
  },
  verifyOtp: {
    type: String,
    default: ''
  },
  verifyOtpExpiry: {
    type: Number,
    default: 0
  },
  isAccountVerified: {
    type: Boolean,
    default: false
  },
  resetOtp: {
    type: String,
    default: ''
  },
  resetOtpExpiry: {
    type: Number,
    default: 0
  },
  activeDates: {
    type: [Date],
    default: []
  },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.password) return;
  if (!this.isModified('password')) {
    console.log('[DEBUG] Password not modified, skipping hash');
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    console.error('[DEBUG] Password hash error:', error);
    throw error;
  }
});

userSchema.methods.updateStreakOnAppOpen = async function () {
  const today = getUTCDateOnly();
  const lastActive = this.lastActive
    ? getUTCDateOnly(this.lastActive)
    : null;

  const todayStr = today.toISOString().split('T')[0];
  const lastActiveStr = lastActive ? lastActive.toISOString().split('T')[0] : null;

  if (lastActiveStr === todayStr) {
    // Already opened today, but check achievements anyway to be safe (idempotent)
    console.log('[DEBUG] App already opened today, checking achievements for safety');
    try {
      await checkStreakAchievements(this._id, this);
    } catch (e) {
      console.error('Error checking streak achievements:', e);
    }

    if (!this.activeDates.find(d => getUTCDateOnly(d).toISOString().split('T')[0] === todayStr)) {
      this.activeDates.push(today);
      await this.save();
    }
    return;
  }

  if (!lastActive) {
    this.currentStreak = 1;
    this.longestStreak = 1;
  } else {
    const diff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      // Normal continuation
      this.currentStreak += 1;
      try {
        await checkStreakAchievements(this._id, this);
        console.log('Streak achievements checked successfully');
      } catch (e) {
        console.error('Error checking streak achievements:', e);
      }
      // Ensure yesterday (lastActive) is in activeDates
      const lastActiveStr = lastActive.toISOString().split('T')[0];
      if (!this.activeDates.find(d => getUTCDateOnly(d).toISOString().split('T')[0] === lastActiveStr)) {
        this.activeDates.push(lastActive);
      }
    }
  }

  this.longestStreak = Math.max(
    this.longestStreak,
    this.currentStreak
  );

  this.lastActive = today;

  if (!this.activeDates.find(d => getUTCDateOnly(d).toISOString().split('T')[0] === todayStr)) {
    this.activeDates.push(today);
  }

  this.markModified('activeDates');
  await this.save();
};

userSchema.methods.getContributions = function (days = 105) {
  const contributions = [];
  const endDate = getUTCDateOnly();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - days + 1);

  // Create a set of date strings "YYYY-MM-DD" for easy lookup
  const activeSet = new Set(this.activeDates.map(d => {
    try {
      const dateObj = new Date(d);
      return dateObj.toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  }).filter(Boolean));

  // Backfill: If they have a streak, these days MUST be active
  if (this.currentStreak > 0 && this.lastActive) {
    let streakDate = getUTCDateOnly(this.lastActive);
    for (let i = 0; i < this.currentStreak; i++) {
      activeSet.add(streakDate.toISOString().split('T')[0]);
      streakDate.setUTCDate(streakDate.getUTCDate() - 1);
    }
  }

  // Loop exactly 'days' times from startDate to endDate
  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    contributions.push({
      date: dateStr,
      showedUp: activeSet.has(dateStr),
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return contributions;
};


userSchema.methods.matchPassword = async function (enteredPassword) {
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  return isMatch;
};

const User = mongoose.model("User", userSchema);
export default User;
