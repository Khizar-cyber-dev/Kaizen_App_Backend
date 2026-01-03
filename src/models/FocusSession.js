import mongoose from "mongoose";

const focusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
  },
  habitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Habit',
    default: null,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  intendedDuration: {
    type: Number,
    required: true,
  },
  actualDuration: {
    type: Number,
  },
  interruptions: {
    type: Number,
    default: 0,
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
  lastPauseTime: {
    type: Date,
    default: null,
  },
  totalPauseDuration: {
    type: Number,
    default: 0, // In milliseconds
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  notes: {
    type: String,
  },
  status: {
    type: String,
    enum: ['completed', 'abandoned', 'in_progress', 'continued'],
    default: 'in_progress',
  },
  sessionType: {
    type: String,
    enum: ['habit', 'general'],
    required: true,
  },
  sessionNumber: {
    type: Number,
  },
  aiTips: {
    type: String,
  },
}, { timestamps: true });

const FocusSession = mongoose.model("FocusSession", focusSchema);
export default FocusSession;