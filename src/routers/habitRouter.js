import { Router } from "express";
import { createHabit, getHabits, deleteHabit, updateHabit } from "../controllers/habitController.js";

const router = Router();

// Create a new habit
router.post('/', createHabit);

// Get all habits for a user
router.get('/:userId', getHabits);

// Update a habit
router.put('/:habitId', updateHabit);

// Delete a habit
router.delete('/:habitId', deleteHabit);

export default router;