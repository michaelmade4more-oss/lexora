import { buildApp } from './app.js';

const { app } = buildApp();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4100);
app.listen({ host, port }).catch(error => { app.log.error(error); process.exit(1); });
