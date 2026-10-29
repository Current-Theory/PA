import { createServer } from 'node:http';
import { assistantHandler } from './assistant.ts';

// Local development adapter only. Hosting requires organisational authentication
// and a same-origin API route; never expose this local listener as a public API.
const port = Number(process.env.WORK_HUB_AI_PORT ?? 8787);
const handler = assistantHandler({
  key: process.env.WORK_HUB_AI_KEY,
  model: process.env.WORK_HUB_AI_MODEL ?? 'gpt-5-mini',
  allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
});
createServer((request, response) => { void handler(request, response); }).listen(port, '127.0.0.1', () => {
  console.log(`Work Hub assistant adapter listening on loopback port ${port}. API key configured: ${!!process.env.WORK_HUB_AI_KEY}.`);
});
