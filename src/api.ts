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
  // Database row timestamps only. Do NOT use for client ordering/merge.
  dbCreatedAt: string;
  dbUpdatedAt: string;
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

export type ProfileUser = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  displayName?: string;
  username?: string;
};

export type FeedbackStatus = "new" | "triaged" | "done";

export type SubmitFeedbackInput = {
  category?: string;
  message: string;
  context?: Record<string, unknown>;
};

export type SubmitFeedbackResult = {
  ok: true;
  id: number;
};

export type FeedbackAdminItem = {
  id: number;
  userId: number;
  category: string;
  message: string;
  context: Record<string, unknown>;
  status: FeedbackStatus;
  createdAt: string;
};

export type ListFeedbackAdminInput = {
  limit?: number;
  beforeId?: number;
};

export type ListFeedbackAdminResult = {
  ok: true;
  items: FeedbackAdminItem[];
  nextCursor?: number;
};

type SubmitFeedbackResponse = {
  ok?: boolean;
  id?: unknown;
};

type FeedbackAdminItemRaw = {
  id?: unknown;
  userId?: unknown;
  user_id?: unknown;
  category?: unknown;
  message?: unknown;
  context?: unknown;
  context_json?: unknown;
  status?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
};

type ListFeedbackAdminResponse = {
  ok?: boolean;
  items?: FeedbackAdminItemRaw[];
  nextCursor?: unknown;
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
    dbCreatedAt: String(item?.created_at ?? ""),
    dbUpdatedAt: String(item?.updated_at ?? ""),
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

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function toFeedbackStatus(value: unknown): FeedbackStatus {
  if (value === "new" || value === "triaged" || value === "done") return value;
  return "new";
}

function toFeedbackAdminItem(raw: FeedbackAdminItemRaw): FeedbackAdminItem | null {
  const id = Number(raw.id);
  const userId = Number(raw.userId ?? raw.user_id);
  if (!Number.isFinite(id) || !Number.isFinite(userId)) return null;

  const category = typeof raw.category === "string" ? raw.category : "";
  const message = typeof raw.message === "string" ? raw.message : "";
  const contextValue = raw.context ?? raw.context_json;
  const context = contextValue && typeof contextValue === "object" && !Array.isArray(contextValue)
    ? contextValue as Record<string, unknown>
    : {};
  const createdAtValue = raw.createdAt ?? raw.created_at;
  const createdAt = typeof createdAtValue === "string" ? createdAtValue : "";

  return {
    id,
    userId,
    category,
    message,
    context,
    status: toFeedbackStatus(raw.status),
    createdAt,
  };
}

export async function updateProfile(input: {
  displayName: string;
  username: string;
}): Promise<ProfileUser> {
  const result = await apiPost("/api/profile/update", {
    displayName: input.displayName,
    username: input.username,
  });
  if (!result.ok) {
    throw new Error(buildApiErrorMessage("updateProfile", result));
  }
  const data = (result.data || {}) as { ok?: boolean; user?: Record<string, unknown> };
  if (!data.ok || !data.user || typeof data.user !== "object") {
    throw new Error("updateProfile failed: invalid response");
  }
  return {
    sub: toOptionalString(data.user.sub),
    email: toOptionalString(data.user.email),
    name: toOptionalString(data.user.name),
    picture: toOptionalString(data.user.picture),
    displayName: toOptionalString(data.user.displayName),
    username: toOptionalString(data.user.username),
  };
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const result = await apiPost("/api/feedback", {
    category: input.category ?? "",
    message: input.message,
    context: input.context ?? undefined,
  });

  if (!result.ok) {
    throw new Error(buildApiErrorMessage("submitFeedback", result));
  }

  const data = (result.data || {}) as SubmitFeedbackResponse;
  if (!data.ok || typeof data.id !== "number" || !Number.isFinite(data.id)) {
    throw new Error("submitFeedback failed: invalid response");
  }

  return {
    ok: true,
    id: data.id,
  };
}

export async function listFeedbackAdmin(input?: ListFeedbackAdminInput): Promise<ListFeedbackAdminResult> {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(input.limit));
  }
  if (typeof input?.beforeId === "number" && Number.isFinite(input.beforeId)) {
    params.set("beforeId", String(input.beforeId));
  }
  const query = params.toString();
  const path = query ? `/api/feedback?${query}` : "/api/feedback";

  const result = await apiGet(path);
  if (!result.ok) {
    throw new Error(buildApiErrorMessage("listFeedbackAdmin", result));
  }

  const data = (result.data || {}) as ListFeedbackAdminResponse;
  if (!data.ok || !Array.isArray(data.items)) {
    throw new Error("listFeedbackAdmin failed: invalid response");
  }

  const items = data.items
    .map((raw) => toFeedbackAdminItem(raw))
    .filter((item): item is FeedbackAdminItem => item !== null);
  const nextCursor = toOptionalFiniteNumber(data.nextCursor);

  return {
    ok: true,
    items,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
}

// TODO(auth): add a client helper for POST /auth/logout (credentials include) when UI is added.
