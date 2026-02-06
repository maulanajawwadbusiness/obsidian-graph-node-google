/**
 * Midtrans production GoPay QRIS charge smoke test.
 *
 * Run:
 *   npm run test:midtrans-prod-gopayqris
 */

import fs from 'fs';
import path from 'path';
import { midtransRequest } from './client';

type ActionSummary = {
  name: string;
  method: string;
  url: string;
};

function sanitizeActions(value: unknown): ActionSummary[] {
  if (!Array.isArray(value)) return [];
  const out: ActionSummary[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const name = String((item as { name?: unknown }).name || '').trim();
    const method = String((item as { method?: unknown }).method || '').trim();
    const url = String((item as { url?: unknown }).url || '').trim();
    if (name && method && url) out.push({ name, method, url });
  }
  return out;
}

async function run(): Promise<void> {
  const orderId = `arnv-prod-gopayqris-${Date.now()}`;
  const payload = {
    payment_type: 'gopay',
    transaction_details: {
      order_id: orderId,
      gross_amount: 1000
    },
    gopay: {
      enable_callback: true,
      callback_url: 'https://<your-domain>/payment/gopay-finish'
    }
  };

  const result = await midtransRequest('/v2/charge', {
    method: 'POST',
    body: payload
  });

  if (result.ok === false) {
    const status = result.status ?? 'unknown';
    console.log(`[midtrans] charge failed status=${status}`);
    console.log(JSON.stringify(result.error));
    return;
  }

  const data = result.data as {
    status_code?: string;
    status_message?: string;
    order_id?: string;
    transaction_id?: string;
    transaction_status?: string;
    payment_type?: string;
    actions?: unknown;
  };

  const actions = sanitizeActions(data.actions);

  console.log(`[midtrans] charge ok status=${result.status}`);
  console.log(`status_code=${data.status_code || ''}`);
  console.log(`status_message=${data.status_message || ''}`);
  console.log(`order_id=${data.order_id || orderId}`);
  console.log(`transaction_id=${data.transaction_id || ''}`);
  console.log(`transaction_status=${data.transaction_status || ''}`);
  console.log(`payment_type=${data.payment_type || ''}`);

  if (actions.length > 0) {
    for (const action of actions) {
      console.log(`action=${action.name} method=${action.method} url=${action.url}`);
    }
  }

  const outDir = path.join('.local');
  const outFile = path.join(outDir, 'midtrans-last-response.json');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result.data, null, 2));
  console.log(`[midtrans] raw response saved to ${outFile}`);
}

run().catch((err) => {
  console.log(`[midtrans] smoke test crashed: ${String(err)}`);
  process.exitCode = 1;
});
