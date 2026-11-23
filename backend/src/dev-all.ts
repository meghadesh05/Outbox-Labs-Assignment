import { startServer } from './index.js';
import { startEmailWorker } from './queue/emailWorker.js';

async function runDevAll() {
  console.log('🌟 Starting ReachInbox API Server + BullMQ Worker in unified dev runner...');
  await startServer();
  startEmailWorker();
  console.log('✅ Both Express API and BullMQ Worker are active.');
}

runDevAll().catch((err) => {
  console.error('Failed to run unified dev runner:', err);
  process.exit(1);
});
