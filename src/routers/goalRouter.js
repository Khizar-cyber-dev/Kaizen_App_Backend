import { Router } from "express";
import { createGoal, deleteGoal, getGoals, toggleGoalCompletion } from "../controllers/goalController.js";

const router = Router();

// Create a new goal
router.post('/', createGoal);

// Get all goals for a user
router.get('/:userId', getGoals);

// Toggle goal completion
router.get('/toggle/:goalId', toggleGoalCompletion);

// Delete a goal
router.delete('/:goalId', deleteGoal);

export default router;