import express from 'express';
import connectDB from './config/db.js';
import goalRouter from './routers/goalRouter.js';
import sessionRouter from './routers/sessionRouter.js';
import habitRouter from './routers/habitRouter.js';
import authRouter from './routers/authRouter.js';
import dailyStatsRouter from './routers/dailyStatsRouter.js';
import achievementRouter from './routers/achievementsRouter.js';
// import cronRouter from './routers/cronRouter.js';
import journalRouter from './routers/journalRouter.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { registerAllCrons } from './queues/scheduleQueue.js';
import './workers/emailWorker.js';
import './workers/habitWorker.js';
// import './config/cron.js';
import 'dotenv/config';
import { errorHandler, notFound } from './middleware/errorHandler.js';

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
// app.use('/api/cron', cronRouter);
app.use('/api/journals', journalRouter);


app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// ping endpoint to check if server is alive
app.get('/ping', (req, res) => {
    res.json({ message: 'pong' });
});

// 404 + global error handler (must be after routes)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, async () => {
    connectDB();
    registerAllCrons().catch((err) => {
        console.error('Cron registration failed (continuing without scheduled jobs):', err?.message || err);
    });
    console.log(`Server is running on port ${PORT}`);
});
