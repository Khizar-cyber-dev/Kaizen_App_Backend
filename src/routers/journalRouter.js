import { Router } from "express";
import {
  createMorningJournal,
  createEveningJournal,
  getJournalByDate,
  getJournalHistory,
  getDailyAIReflection,
  getWeeklyAIInsight,
} from "../controllers/journalController.js";

const router = Router();

router.post("/morning", createMorningJournal); // true
router.post("/evening", createEveningJournal); // true
router.get("/by-date", getJournalByDate); // true
router.get("/history", getJournalHistory); // true

router.post("/ai/daily-reflection", getDailyAIReflection); // true
router.post("/ai/weekly-insight", getWeeklyAIInsight);

export default router;
