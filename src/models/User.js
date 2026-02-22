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
    console.log('Password not modified, skipping hash');
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    console.error('Password hash error:', error);
    throw error;
  }
});

userSchema.methods.updateStreakOnAppOpen = async function () {
  const today = getUTCDateOnly();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Ensure today is in activeDates (deduplicated)
  const dateExists = this.activeDates.some(d => getUTCDateOnly(d).toISOString().split('T')[0] === todayStr);
  if (!dateExists) {
    this.activeDates.push(today);
  }

  // 2. Sort and Deduplicate activeDates for calculation
  const uniqueDates = Array.from(new Set(this.activeDates.map(d => getUTCDateOnly(d).toISOString().split('T')[0])))
    .sort((a, b) => new Date(b) - new Date(a)); // Descending order (newest first)

  this.activeDates = uniqueDates.map(dStr => new Date(dStr));

  // 3. Calculate current streak (consecutive days backwards from today, allowing 1-day grace)
  let streak = 0;
  let curr = new Date(today);
  let gaps = 0;

  // We loop backwards until we find a gap > 1 day
  while (true) {
    const dStr = curr.toISOString().split('T')[0];
    if (uniqueDates.includes(dStr)) {
      streak++;
      gaps = 0; // Reset gap counter
    } else {
      gaps++;
      if (gaps > 1) break; // More than 1 day gap breaks the streak
    }
    curr.setUTCDate(curr.getUTCDate() - 1);

    // Safety break to prevent infinite loops if something goes wrong with uniqueDates
    if (streak > 5000) break;
  }

  this.currentStreak = streak;
  this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
  this.lastActive = today;

  this.markModified('activeDates');
  await this.save();

  // 4. Check achievements
  try {
    await checkStreakAchievements(this._id, this);
  } catch (e) {
    console.error('Error checking streak achievements:', e);
  }
};

userSchema.methods.getContributions = function (days = 105) {
  const contributions = [];
  const endDate = getUTCDateOnly();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - days + 1);

  // Create a set of date strings "YYYY-MM-DD" for easy lookup
  const activeSet = new Set(this.activeDates.map(d => {
    try {
      return new Date(d).toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  }).filter(Boolean));

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
