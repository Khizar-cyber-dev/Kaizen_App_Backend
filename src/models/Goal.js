import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
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
    enum: ['week', 'month', '3_month', '6_month', 'year', 'other'],
    required: true,
  },
  // Dates
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
  completedDate: {
    type: Date,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active',
  },
}, { timestamps: true });

const Goal = mongoose.model("Goal", goalSchema);
export default Goal;