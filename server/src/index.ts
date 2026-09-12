import { buildApp } from './app.js';
import { createPool } from './db/postgres.js';
import { PostgresRepository } from './db/repository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for normal Lexora runtime');
if (String(process.env.NODE_ENV) === 'production' && !process.env.LEXORA_ALLOWED_ORIGIN) throw new Error('LEXORA_ALLOWED_ORIGIN is required in production');

const pool = createPool(databaseUrl);
await pool.query('SELECT 1');
const repository = new PostgresRepository(pool);
const { app } = buildApp({ repository });
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4100);

try {
  await app.listen({ host, port });
  const shutdown = async () => { await app.close(); await pool.end(); process.exit(0); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  await pool.end();
  app.log.error(error);
  process.exit(1);
}
