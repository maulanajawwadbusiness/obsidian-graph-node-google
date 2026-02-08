type MoneyNetworkSignal = {
    status?: number | null;
    error?: unknown;
    contentType?: string | null;
    reason?: string | null;
};

const NETWORK_ERROR_SNIPPETS = [
    'failed to fetch',
    'networkerror',
    'err_connection',
    'err_internet_disconnected',
    'load failed',
    'stream_http_5',
    'stream_http_0',
    'html response',
    'unexpected content-type',
    'typeerror: failed to fetch',
    'network request failed',
    'gateway timeout',
    'bad gateway',
];

function toText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    return String(value ?? '');
}

function hasNetworkSnippet(text: string): boolean {
    const normalized = text.toLowerCase();
    return NETWORK_ERROR_SNIPPETS.some((snippet) => normalized.includes(snippet));
}

export function isOfflineOrUnreachable(signal?: MoneyNetworkSignal): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return true;
    }

    const status = signal?.status;
    if (typeof status === 'number' && status >= 500) {
        return true;
    }

    const text = `${toText(signal?.error)} ${toText(signal?.reason)} ${toText(signal?.contentType)}`.trim();
    return hasNetworkSnippet(text);
}

export function shouldSuppressMoneyNoticeForNetworkFailure(signal?: MoneyNetworkSignal): boolean {
    return isOfflineOrUnreachable(signal);
}
