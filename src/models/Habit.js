import mongoose from "mongoose";
import { getUTCDateOnly } from "../lib/helper.js";

const habitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  sessionMinutes: {
    type: Number,
  },
  color: {
    type: String,
    default: "#4F46E5",
  },
  icon: {
    type: String,
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'custom'],
    default: 'daily',
  },
  targetDaysPerWeek: {
    type: Number,
    min: 1,
    max: 7,
    default: 7,
  },
  totalSessionsCompleted: {
    type: Number,
    default: 0,
  },
  totalSessionsStarted: {
    type: Number,
    default: 0,
  },
  totalTimeSpent: {
    type: Number, 
    default: 0,
  },
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
  },
  lastCompletedDate: {
    type: Date,
  },
  todays_done: {
    type: Boolean,
    default: false,
  },
  completionDates: [{
    date: {
      type: Date,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FocusSession',
      default: null,
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  successRate: {
    type: Number, 
    default: 0,
  },
  averageSessionTime: {
    type: Number,
    default: 0,
  },
  contributions: [{
    date: {
      type: String, 
      required: true,
    },
    level: {
      type: Number,
      required: true,
      min: 0,
      max: 2,
    }
  }],
  tier: {
    type: String,
    default: 'bronze',
  },
  type: {
    type: String,
    enum: ['session', 'task'],
    default: 'session',
  }
}, { timestamps: true });

// Method to update streak
habitSchema.methods.updateStreak = function () {
  const today = getUTCDateOnly();

  const lastCompleted = this.lastCompletedDate
    ? getUTCDateOnly(this.lastCompletedDate)
    : null;

  if (!lastCompleted) {
    // First ever completion
    this.currentStreak = 1;
  } else {
    const diff =
      (today - lastCompleted) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      // Normal continuation
      this.currentStreak += 1;
    }
  }

  this.longestStreak = Math.max(
    this.longestStreak,
    this.currentStreak
  );

  this.lastCompletedDate = today;
  this.todays_done = true;
};


const Habit = mongoose.model("Habit", habitSchema);
export default Habit;