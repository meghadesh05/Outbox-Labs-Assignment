import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { query } from '../db/db.js';

let esClient: Client | null = null;
let esAvailable = false;

const INDEX_NAME = 'reachinbox_emails';

export async function initElasticsearch(): Promise<boolean> {
  try {
    esClient = new Client({
      node: env.ELASTICSEARCH_URL,
      maxRetries: 2,
      requestTimeout: 2000,
    });

    // Check cluster health
    await esClient.ping();
    esAvailable = true;
    console.log(`[Elasticsearch] Connected to Elasticsearch at ${env.ELASTICSEARCH_URL}`);

    // Create index if it does not exist
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              user_id: { type: 'integer' },
              sender_id: { type: 'integer' },
              sender_email: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduled_at: { type: 'date' },
              sent_at: { type: 'date' },
              created_at: { type: 'date' },
              ethereal_preview_url: { type: 'text' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index '${INDEX_NAME}' created.`);
    }
    return true;
  } catch (err: any) {
    esAvailable = false;
    console.warn(`[Elasticsearch] Could not connect to Elasticsearch at ${env.ELASTICSEARCH_URL} (${err.message}).`);
    console.log(`[Elasticsearch] Falling back to PostgreSQL full-text search for search queries.`);
    return false;
  }
}

export async function indexEmailDocument(doc: {
  id: string;
  user_id: number;
  sender_id?: number;
  sender_email?: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: string | Date;
  sent_at?: string | Date | null;
  created_at?: string | Date;
  ethereal_preview_url?: string | null;
}) {
  if (!esAvailable || !esClient) return;

  try {
    await esClient.index({
      index: INDEX_NAME,
      id: doc.id,
      document: {
        ...doc,
        scheduled_at: new Date(doc.scheduled_at).toISOString(),
        sent_at: doc.sent_at ? new Date(doc.sent_at).toISOString() : null,
      },
      refresh: true,
    });
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to index document ${doc.id}:`, err.message);
  }
}

export async function searchEmails(userId: number, searchTerm: string): Promise<any[]> {
  const cleanTerm = searchTerm.trim();
  if (!cleanTerm) return [];

  // 1. Try Elasticsearch if available
  if (esAvailable && esClient) {
    try {
      const response = await esClient.search({
        index: INDEX_NAME,
        body: {
          query: {
            bool: {
              must: [
                { term: { user_id: userId } },
                {
                  multi_match: {
                    query: cleanTerm,
                    fields: ['recipient^3', 'subject^2', 'body', 'sender_email'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
        },
      });

      const hits = (response.hits.hits || []).map((hit: any) => hit._source);
      return hits;
    } catch (err: any) {
      console.warn(`[Elasticsearch] Search query failed, falling back to DB:`, err.message);
    }
  }

  // 2. Resilient Database Fallback
  const dbResult = await query(
    `SELECT e.*, s.name as sender_name, s.email as sender_email
     FROM emails e
     LEFT JOIN senders s ON e.sender_id = s.id
     WHERE e.user_id = $1
       AND (e.recipient ILIKE $2 OR e.subject ILIKE $2 OR e.body ILIKE $2)
     ORDER BY e.created_at DESC
     LIMIT 50`,
    [userId, `%${cleanTerm}%`]
  );

  return dbResult.rows;
}
