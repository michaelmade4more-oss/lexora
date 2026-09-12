import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return new Pool({ connectionString, max: 10 });
}

export async function runMigrations(pool: Pool, migrationsDir = path.resolve(process.cwd(), 'migrations')) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const files = (await readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const found = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (found.rowCount) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client: PoolClient = await pool.connect();
    try { await client.query('BEGIN'); await client.query(sql); await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
