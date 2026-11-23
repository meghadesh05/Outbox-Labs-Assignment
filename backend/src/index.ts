import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { initElasticsearch } from './services/elasticsearch.js';
import { reconcileScheduledJobs } from './queue/reconciliation.js';
import { setupBullBoardRouter } from './queue/bullBoard.js';
import { authRouter } from './routes/auth.routes.js';
import { slackRouter } from './routes/slack.routes.js';
import { senderRouter } from './routes/sender.routes.js';
import { emailRouter } from './routes/email.routes.js';
import { getRedisClient } from './services/redis.js';
import { query } from './db/db.js';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow frontend origin, localhost, or requests with no origin (e.g. mobile/curl)
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bull Board UI mounted at /admin/queues
try {
  const bullBoardRouter = setupBullBoardRouter();
  app.use('/admin/queues', bullBoardRouter);
  console.log('[App] Bull Board dashboard mounted at /admin/queues');
} catch (err: any) {
  console.warn('[App] Bull Board initialization warning:', err.message);
}

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';
  let esStatus = 'ok';

  try {
    await query('SELECT 1');
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message}`;
  }

  try {
    const redis = getRedisClient();
    await redis.ping();
  } catch (err: any) {
    redisStatus = `unreachable: ${err.message}`;
  }

  try {
    const esOk = await initElasticsearch();
    if (!esOk) esStatus = 'unreachable (fallback to DB search)';
  } catch (err: any) {
    esStatus = `error: ${err.message}`;
  }

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
    },
  });
});

// Mount Application API Routers
app.use('/api/auth', authRouter);
app.use('/api/slack', slackRouter);
app.use('/api/senders', senderRouter);
app.use('/api/emails', emailRouter);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    app: 'ReachInbox Email Scheduler API',
    version: '1.0.0',
    documentation: 'See README.md for endpoint details',
    bullBoard: '/admin/queues',
    health: '/api/health',
  });
});

export async function startServer() {
  try {
    console.log('--- Initializing ReachInbox Backend ---');
    // 1. Run migrations & seeding
    await migrate();

    // 2. Initialize Elasticsearch
    await initElasticsearch();

    // 3. Connect Redis
    const redis = getRedisClient();
    await redis.ping();

    // 4. Run startup reconciliation for pending/delayed jobs
    await reconcileScheduledJobs();

    // 5. Start HTTP Listener
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 ReachInbox API Server is running on http://localhost:${env.PORT}`);
      console.log(`📊 Bull Board Queue Monitor: http://localhost:${env.PORT}/admin/queues`);
    });

    return server;
  } catch (err: any) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  startServer();
}
