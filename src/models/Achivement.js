// Achievement.js (Updated)
import mongoose from "mongoose";

const achievementSchema = new mongoose.Schema({
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
  type: {
    type: String,
    required: true,
    enum: ['streak', 'consistency', 'milestone', 'comeback'],
  },

  // Specific achievement data
  metadata: {
    days: Number,
    streak: Number,
    sessions: Number,
    habitId: mongoose.Schema.Types.ObjectId,
    default: {},
  },

  dateAchieved: {
    type: Date,
    default: Date.now,
  },
  icon: {
    type: String,
  },

  tier: {
    type: String,
    default: 'bronze',
  },
}, { timestamps: true });

const Achievement = mongoose.model("Achievement", achievementSchema);
export default Achievement;