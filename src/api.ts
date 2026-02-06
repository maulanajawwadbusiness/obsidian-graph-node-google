const BASE = import.meta.env.VITE_API_BASE_URL;

export type ApiGetResult = {
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  data: unknown | null;
  text: string;
  error: string | null;
};

export type ApiPostResult = ApiGetResult;

export type PaymentAction = {
  name: string;
  method: string;
  url: string;
};

function resolveUrl(base: string, path: string) {
  const trimmedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

function looksLikeHtml(text: string) {
  const head = text.slice(0, 200).toLowerCase();
  return head.includes('<!doctype') || head.includes('<html');
}

export async function apiGet(path: string): Promise<ApiGetResult> {
  if (!BASE || !BASE.trim()) {
    throw new Error('VITE_API_BASE_URL is missing or empty');
  }

  const url = resolveUrl(BASE, path);
  console.log(`[apiGet] GET ${url}`);

  // All backend calls must include credentials for cookie auth.
  const res = await fetch(url, { credentials: 'include' });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const isJson = contentType.includes('application/json');
  const isHtml = contentType.includes('text/html') || looksLikeHtml(text);

  let data: unknown | null = null;
  let error: string | null = null;

  if (isJson) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      error = `invalid json: ${String(e)}`;
    }
  }

  if (!res.ok) {
    const snippet = text.slice(0, 200);
    error = `http ${res.status}; ${snippet}`;
  } else if (isHtml) {
    const snippet = text.slice(0, 200);
    error = `html response; ${snippet}`;
  } else if (!isJson) {
    const snippet = text.slice(0, 200);
    error = `unexpected content-type: ${contentType || 'unknown'}; ${snippet}`;
  }

  return {
    url,
    status: res.status,
    ok: res.ok && !error,
    contentType,
    data,
    text,
    error
  };
}

export async function apiPost(path: string, body: unknown): Promise<ApiPostResult> {
  if (!BASE || !BASE.trim()) {
    throw new Error('VITE_API_BASE_URL is missing or empty');
  }

  const url = resolveUrl(BASE, path);
  console.log(`[apiPost] POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const isJson = contentType.includes('application/json');
  const isHtml = contentType.includes('text/html') || looksLikeHtml(text);

  let data: unknown | null = null;
  let error: string | null = null;

  if (isJson) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      error = `invalid json: ${String(e)}`;
    }
  }

  if (!res.ok) {
    const snippet = text.slice(0, 200);
    error = `http ${res.status}; ${snippet}`;
  } else if (isHtml) {
    const snippet = text.slice(0, 200);
    error = `html response; ${snippet}`;
  } else if (!isJson) {
    const snippet = text.slice(0, 200);
    error = `unexpected content-type: ${contentType || 'unknown'}; ${snippet}`;
  }

  return {
    url,
    status: res.status,
    ok: res.ok && !error,
    contentType,
    data,
    text,
    error
  };
}

export async function createPaymentGopayQris(grossAmount?: number): Promise<ApiPostResult> {
  return apiPost('/api/payments/gopayqris/create', {
    gross_amount: grossAmount
  });
}

export async function getPaymentStatus(orderId: string): Promise<ApiGetResult> {
  return apiGet(`/api/payments/${orderId}/status`);
}

// TODO(auth): add a client helper for POST /auth/logout (credentials include) when UI is added.
