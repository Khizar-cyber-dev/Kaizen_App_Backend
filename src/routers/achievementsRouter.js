import { Router } from "express";
import { getUserAchievements } from "../controllers/achievementController.js";

const router = Router();

// Get user achievements
router.get('/:userId', getUserAchievements);

export default router;