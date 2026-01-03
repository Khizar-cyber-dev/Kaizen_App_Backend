import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import './config/corn.js'; // Import cron jobs
import goalRouter from './routers/goalRouter.js';
import sessionRouter from './routers/sessionRouter.js';
import habitRouter from './routers/habitRouter.js';
import authRouter from './routers/authRouter.js';
import dailyStatsRouter from './routers/dailyStatsRouter.js';
import achievementRouter from './routers/achievementsRouter.js';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/goals', goalRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/habits', habitRouter);
app.use('/api/auth', authRouter);
app.use('/api/daily-stats', dailyStatsRouter);
app.use('/api/achievements', achievementRouter);

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(3000, () => {
    connectDB();
    console.log(`Server is running on port ${3000}`);
});