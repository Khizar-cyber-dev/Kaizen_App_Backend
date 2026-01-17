import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import './config/cron.js'; // Import cron jobs
import goalRouter from './routers/goalRouter.js';
import sessionRouter from './routers/sessionRouter.js';
import habitRouter from './routers/habitRouter.js';
import authRouter from './routers/authRouter.js';
import dailyStatsRouter from './routers/dailyStatsRouter.js';
import achievementRouter from './routers/achievementsRouter.js';
import cronRouter from './routers/cronRouter.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
    origin: true, // Allow all origins for mobile app
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/goals', goalRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/habits', habitRouter);
app.use('/api/auth', authRouter);
app.use('/api/daily-stats', dailyStatsRouter);
app.use('/api/achievements', achievementRouter);
app.use('/api/cron', cronRouter);

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on port ${PORT}`);
});