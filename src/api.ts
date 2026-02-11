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

export type SavedInterfaceApiRecord = {
  clientInterfaceId: string;
  title: string;
  payloadVersion: number;
  payloadJson: any;
  createdAt: string;
  updatedAt: string;
};

export type SavedInterfaceUpsertInput = {
  clientInterfaceId: string;
  title: string;
  payloadVersion: number;
  payloadJson: any;
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

function buildApiErrorMessage(op: string, result: ApiGetResult | ApiPostResult) {
  const status = result.status || 0;
  const detail = result.error || result.text.slice(0, 200) || 'unknown error';
  if (status === 401) return `${op} failed: unauthorized (401)`;
  return `${op} failed: ${status || "unknown"} ${detail}`;
}

type SavedInterfacesListResponse = {
  ok?: boolean;
  items?: SavedInterfacesListItem[];
};

type SavedInterfacesDeleteResponse = {
  ok?: boolean;
  deleted?: unknown;
};

type SavedInterfacesListItem = {
  client_interface_id?: unknown;
  title?: unknown;
  payload_version?: unknown;
  payload_json?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function toSavedInterfaceRecord(item: SavedInterfacesListItem): SavedInterfaceApiRecord {
  return {
    clientInterfaceId: String(item?.client_interface_id ?? ""),
    title: String(item?.title ?? ""),
    payloadVersion: Number(item?.payload_version ?? 0),
    payloadJson: item?.payload_json,
    createdAt: String(item?.created_at ?? ""),
    updatedAt: String(item?.updated_at ?? ""),
  };
}

export async function listSavedInterfaces(): Promise<SavedInterfaceApiRecord[]> {
  const result = await apiGet('/api/saved-interfaces');
  if (!result.ok) {
    throw new Error(buildApiErrorMessage('listSavedInterfaces', result));
  }

  const data = (result.data || {}) as SavedInterfacesListResponse;
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map(toSavedInterfaceRecord).filter((item) => item.clientInterfaceId);
  return items;
}

export async function upsertSavedInterface(
  input: SavedInterfaceUpsertInput
): Promise<{ ok: true }> {
  const result = await apiPost('/api/saved-interfaces/upsert', {
    clientInterfaceId: input.clientInterfaceId,
    title: input.title,
    payloadVersion: input.payloadVersion,
    payloadJson: input.payloadJson,
  });

  if (!result.ok) {
    throw new Error(buildApiErrorMessage('upsertSavedInterface', result));
  }

  return { ok: true };
}

export async function deleteSavedInterface(
  clientInterfaceId: string
): Promise<{ ok: true; deleted?: boolean }> {
  const result = await apiPost('/api/saved-interfaces/delete', { clientInterfaceId });
  if (!result.ok) {
    throw new Error(buildApiErrorMessage('deleteSavedInterface', result));
  }

  const data = (result.data || {}) as SavedInterfacesDeleteResponse;
  const deleted = typeof data.deleted === 'boolean' ? data.deleted : undefined;
  return deleted === undefined ? { ok: true } : { ok: true, deleted };
}

// TODO(auth): add a client helper for POST /auth/logout (credentials include) when UI is added.
