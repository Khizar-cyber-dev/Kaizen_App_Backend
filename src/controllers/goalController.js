import { calculateEndDate } from "../lib/helper.js";
import Goal from "../models/Goal.js";

export async function createGoal(req, res) {
    try {
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
    } catch (error) {
        console.error('Error creating goal:', error);
        res.status(500).json({
            message: 'Failed to create goal',
            error: error.message
        });
    }
}

export async function getGoals(req, res) {
    try {
        const { userId } = req.params;
        const goals = await Goal.find({ userId });

        res.status(200).json({
            message: 'Goals retrieved successfully',
            goals
        });
    } catch (error) {
        console.error('Error retrieving goals:', error);
        res.status(500).json({
            message: 'Failed to retrieve goals',
            error: error.message
        });
    }
}

export async function toggleGoalCompletion(req, res) {
    try {
        const { goalId } = req.params;
        const goal = await Goal.findById(goalId);

        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
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
    } catch (error) {
        console.error('Error toggling goal completion status:', error);
        res.status(500).json({
            message: 'Failed to toggle goal completion status',
            error: error.message
        });
    }
}

export const deleteGoal = async (req, res) => {
    try {
        const { goalId } = req.params;
        const goal = await Goal.findById(goalId);

        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        await Goal.deleteOne({ _id: goalId });

        res.status(200).json({
            message: 'Goal deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({
            message: 'Failed to delete goal',
            error: error.message
        });
    }
};
