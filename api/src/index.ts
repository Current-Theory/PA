import { app } from '@azure/functions';
import { hostedAssistant } from './handler.ts';

const handler = hostedAssistant({
  key: process.env.WORK_HUB_AI_KEY,
  model: process.env.WORK_HUB_AI_MODEL ?? 'gpt-5-mini',
  origin: process.env.WORK_HUB_APP_ORIGIN
});
app.http('assistant', {
  route: 'assistant/{action}', methods: ['GET', 'POST'],
  // The managed SWA gateway enforces workhub_user before this handler, which
  // also checks the injected principal. Do not publish as a standalone Function.
  authLevel: 'anonymous', handler
});
