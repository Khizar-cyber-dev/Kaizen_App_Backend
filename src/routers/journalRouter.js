import { Router } from "express";
import {
  createMorningJournel,
  createEveningJournel,
  getJournelByDate,
  getJournelHistory,
  getDailyAIReflection,
  getWeeklyAIInsight,
} from "../controllers/journalController.js";

const router = Router();

router.post("/morning", createMorningJournel);
router.post("/evening", createEveningJournel);
router.get("/by-date", getJournelByDate);
router.get("/history", getJournelHistory);

router.post("/ai/daily-reflection", getDailyAIReflection);
router.post("/ai/weekly-insight", getWeeklyAIInsight);

export default router;
