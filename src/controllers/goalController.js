import { calculateEndDate } from "../lib/helper.js";
import Goal from "../models/Goal.js";
import AppError from "../lib/AppError.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const createGoal = asyncHandler(async (req, res) => {
    const { userId, title, description, type, startDate, customDays } = req.body;

    const start = startDate ? new Date(startDate) : new Date();
    const endDate = calculateEndDate(start, type, customDays);
    const newGoal = new Goal({
        userId,
        title,
        description,
        type,
        startDate: start,
        endDate,
        status: 'active'
    });

    await newGoal.save();
    console.log("Goal saved successfully:", newGoal);
    res.status(201).json({
        message: 'Goal created successfully',
        goal: newGoal
    });
});

export const getGoals = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const goals = await Goal.find({ userId });

    res.status(200).json({
        message: 'Goals retrieved successfully',
        goals
    });
});

export const toggleGoalCompletion = asyncHandler(async (req, res) => {
    const { goalId } = req.params;
    const goal = await Goal.findById(goalId);

    if (!goal) {
        throw new AppError('Goal not found', 404);
    }
    goal.completed = !goal.completed;
    if (goal.completed) {
        goal.status = 'completed';
        goal.completedDate = new Date();
    } else {
        goal.status = 'active';
        goal.completedDate = null;
    }
    await goal.save();

    res.status(200).json({
        message: 'Goal completion status toggled successfully',
        goal
    });
});

export const deleteGoal = asyncHandler(async (req, res) => {
    const { goalId } = req.params;
    const goal = await Goal.findById(goalId);

    if (!goal) {
        throw new AppError('Goal not found', 404);
    }
    await Goal.deleteOne({ _id: goalId });

    res.status(200).json({
        message: 'Goal deleted successfully'
    });
});
