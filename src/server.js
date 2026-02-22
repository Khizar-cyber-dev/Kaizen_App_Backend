import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import './config/cron.js';
import goalRouter from './routers/goalRouter.js';
import sessionRouter from './routers/sessionRouter.js';
import habitRouter from './routers/habitRouter.js';
import authRouter from './routers/authRouter.js';
import dailyStatsRouter from './routers/dailyStatsRouter.js';
import achievementRouter from './routers/achievementsRouter.js';
import cronRouter from './routers/cronRouter.js';
import journalRouter from './routers/journalRouter.js';
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
app.use('/api/journals', journalRouter);

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// ping endpoint to check if server is alive
app.get('/ping', (req, res) => {
    res.json({ message: 'pong' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on port ${PORT}`);
});
