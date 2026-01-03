import { Router } from "express";
import { getUserCurrentData, getDonutChartData, getTodaysSessions, getOverallConsistencyDays } from "../controllers/dailyStatsController.js";

const router = Router();

// Get user current data
router.get('/current/:userId', getUserCurrentData);

// Get detailed stats for dashboard
router.get('/donut-chart-data/:userId', getDonutChartData);

// Get today's sessions
router.get('/today/:userId', getTodaysSessions);

// Get overall consistency days
router.get('/consistency/:userId', getOverallConsistencyDays);

export default router;