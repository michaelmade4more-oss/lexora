import { createPool, runMigrations } from './postgres.js';

const pool = createPool();
try {
  await runMigrations(pool);
  console.log('Lexora migrations applied');
} finally {
  await pool.end();
}
