import { migrate } from './db/migrate.js';
import { reconcileScheduledJobs } from './queue/reconciliation.js';
import { startEmailWorker } from './queue/emailWorker.js';
import { initElasticsearch } from './services/elasticsearch.js';

async function bootstrapWorker() {
  console.log('--- Starting ReachInbox BullMQ Email Worker Process ---');
  try {
    // 1. Ensure DB schema exists
    await migrate();

    // 2. Initialize Elasticsearch client
    await initElasticsearch();

    // 3. Reconcile missing or delayed jobs from database
    await reconcileScheduledJobs();

    // 4. Start BullMQ worker
    const worker = startEmailWorker();

    console.log('⚡ ReachInbox BullMQ Worker process is live and waiting for jobs.');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[Worker] Gracefully closing worker...');
      await worker.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err: any) {
    console.error('[Worker] Worker bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrapWorker();
