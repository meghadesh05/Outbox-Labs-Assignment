import { Pool, QueryResult, PoolClient } from 'pg';
import { newDb } from 'pg-mem';
import { env } from '../config/env.js';

let pool: Pool;
let isInMemory = false;

export async function initDb(): Promise<Pool> {
  if (pool) return pool;

  try {
    const candidatePool = new Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await candidatePool.connect();
    await client.query('SELECT 1');
    client.release();

    pool = candidatePool;
    isInMemory = false;
    console.log(`[DB] Connected to PostgreSQL at ${env.DATABASE_URL}`);
  } catch (err: any) {
    console.warn(`[DB] Could not connect to external PostgreSQL (${err.message}).`);
    console.log(`[DB] Initializing in-memory PostgreSQL emulator (pg-mem) for autonomous execution.`);
    
    const db = newDb();
    // Register common Postgres functions if needed
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'reachinbox',
    });

    const pgAdapter = db.adapters.createPg();
    pool = new pgAdapter.Pool() as unknown as Pool;
    isInMemory = true;
  }

  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  if (!pool) {
    await initDb();
  }
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    await initDb();
  }
  return pool.connect();
}

export function isDbInMemory(): boolean {
  return isInMemory;
}
