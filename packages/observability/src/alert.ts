import { createLogger } from './logger.js';

const logger = createLogger('alerts');

export async function sendAlert(message: string): Promise<void> {
  logger.warn({ alertMessage: message }, 'alert triggered');

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {
    // Fail-safe: alerting must never throw or reject.
  }
}
