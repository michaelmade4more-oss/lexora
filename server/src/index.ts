import { buildApp } from './app.js';
import { createPool } from './db/postgres.js';
import { PostgresRepository } from './db/repository.js';
import { createRecoveryDeliveryProvider } from './recovery/delivery.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for normal Lexora runtime');
if (String(process.env.NODE_ENV) === 'production' && !process.env.LEXORA_ALLOWED_ORIGIN) throw new Error('LEXORA_ALLOWED_ORIGIN is required in production');
if (String(process.env.NODE_ENV) === 'production' && process.env.RECOVERY_DELIVERY_ENABLED === 'true' && (!process.env.POSTMARK_WEBHOOK_USERNAME || !process.env.POSTMARK_WEBHOOK_PASSWORD || !process.env.RECOVERY_APP_ORIGIN)) throw new Error('Postmark recovery webhook and origin configuration are required');

const pool = createPool(databaseUrl);
await pool.query('SELECT 1');
const repository = new PostgresRepository(pool);
const recoveryProvider = process.env.RECOVERY_DELIVERY_ENABLED === 'true' ? createRecoveryDeliveryProvider() : undefined;
const { app } = buildApp({ repository, recoveryProvider });
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
