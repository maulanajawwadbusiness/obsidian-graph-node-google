import { midtransRequest } from './client';

type TestResult = { name: string; ok: boolean; detail?: string };

function makeResponse(status: number, body: string, statusText = ''): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    statusText,
    text: async () => body
  } as Response;
}

async function run(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: missing server key
  const originalKey = process.env.MIDTRANS_SERVER_KEY;
  process.env.MIDTRANS_SERVER_KEY = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => makeResponse(200, '{"ok":true}')) as typeof fetch;

  const missingKey = await midtransRequest('/v2/charge', { method: 'POST', body: { a: 1 } });
  results.push({
    name: 'missing server key returns structured error',
    ok: !missingKey.ok && missingKey.status === null
  });

  // Test 2: success response
  process.env.MIDTRANS_SERVER_KEY = 'MIDTRANS_SERVER_KEY_TEST';
  globalThis.fetch = (async () => makeResponse(200, '{"status_code":"200","status_message":"OK"}')) as typeof fetch;

  const success = await midtransRequest('/v2/charge', { method: 'POST', body: { a: 1 } });
  results.push({
    name: 'success returns ok true',
    ok: success.ok === true && success.status === 200
  });

  // Test 3: error response
  globalThis.fetch = (async () => makeResponse(400, '{"status_code":"400","status_message":"Bad Request"}')) as typeof fetch;

  const failure = await midtransRequest('/v2/charge', { method: 'POST', body: { a: 1 } });
  results.push({
    name: 'error returns structured error with status',
    ok: failure.ok === false && failure.status === 400
  });

  // Cleanup
  if (originalKey === undefined) {
    delete process.env.MIDTRANS_SERVER_KEY;
  } else {
    process.env.MIDTRANS_SERVER_KEY = originalKey;
  }
  globalThis.fetch = originalFetch;

  return results;
}

run()
  .then((results) => {
    let failed = 0;
    for (const r of results) {
      if (r.ok) {
        console.log(`[ok] ${r.name}`);
      } else {
        console.log(`[fail] ${r.name}${r.detail ? ` - ${r.detail}` : ''}`);
        failed += 1;
      }
    }
    if (failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`[fail] selftest crashed: ${String(err)}`);
    process.exit(1);
  });
