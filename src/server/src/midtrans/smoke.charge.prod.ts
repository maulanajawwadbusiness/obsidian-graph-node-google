/**
 * Midtrans production charge smoke test.
 *
 * Run:
 *   npm run test:midtrans-prod-charge
 */

import fs from 'fs';
import path from 'path';
import { midtransRequest } from './client';

function sanitizeVaNumbers(
  value: unknown
): Array<{ bank: string; va_number: string }> | null {
  if (!Array.isArray(value)) return null;
  const out: Array<{ bank: string; va_number: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const bank = String((item as { bank?: unknown }).bank || '').trim();
    const vaNumber = String((item as { va_number?: unknown }).va_number || '').trim();
    if (bank && vaNumber) out.push({ bank, va_number: vaNumber });
  }
  return out.length > 0 ? out : null;
}

async function run(): Promise<void> {
  const orderId = `arnv-prod-smoke-${Date.now()}`;
  const payload = {
    payment_type: 'bank_transfer',
    transaction_details: {
      order_id: orderId,
      gross_amount: 1000
    },
    bank_transfer: {
      bank: 'bca'
    }
  };

  const result = await midtransRequest('/v2/charge', {
    method: 'POST',
    body: payload
  });

  if (!result.ok) {
    const status = result.status ?? 'unknown';
    console.log(`[midtrans] charge failed status=${status}`);
    console.log(JSON.stringify(result.error));
    return;
  }

  const data = result.data as {
    order_id?: string;
    transaction_id?: string;
    transaction_status?: string;
    payment_type?: string;
    va_numbers?: unknown;
    permata_va_number?: string;
  };

  const vaNumbers = sanitizeVaNumbers(data.va_numbers);

  console.log(`[midtrans] charge ok status=${result.status}`);
  console.log(`order_id=${data.order_id || orderId}`);
  console.log(`transaction_id=${data.transaction_id || ''}`);
  console.log(`transaction_status=${data.transaction_status || ''}`);
  console.log(`payment_type=${data.payment_type || ''}`);
  if (vaNumbers) {
    console.log(`va_numbers=${JSON.stringify(vaNumbers)}`);
  }
  if (data.permata_va_number) {
    console.log(`permata_va_number=${data.permata_va_number}`);
  }

  const outDir = path.join('tmp', 'midtrans');
  const outFile = path.join(outDir, `charge-response-${orderId}.json`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result.data, null, 2));
  console.log(`[midtrans] raw response saved to ${outFile}`);
}

run().catch((err) => {
  console.log(`[midtrans] smoke test crashed: ${String(err)}`);
  process.exitCode = 1;
});
