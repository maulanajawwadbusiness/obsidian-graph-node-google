import React from 'react';
import { createPaymentGopayQris, getPaymentStatus, type PaymentAction } from '../api';
import { refreshBalance } from '../store/balanceStore';
import { subscribeTopupOpen } from '../money/topupEvents';
import { pushMoneyNotice } from '../money/moneyNotices';
import { shouldSuppressMoneyNoticeForNetworkFailure } from '../money/moneyNoticePolicy';

const DEFAULT_AMOUNT = 1000;
const POLL_FAST_MS = 1000;
const POLL_SLOW_MS = 2500;
const POLL_FAST_WINDOW_MS = 10000;
const POLL_TIMEOUT_MS = 180000;

type PaymentState = {
    orderId: string;
    status: string;
    actions: PaymentAction[];
    lastUpdated: number;
};

type PaymentPhase = 'idle' | 'starting' | 'pending' | 'success' | 'failed' | 'cancelled';

type PaymentPanelProps = {
    onPaid?: (orderId: string) => void;
};

export const PaymentGopayPanel: React.FC<PaymentPanelProps> = ({ onPaid }) => {
    const [amount, setAmount] = React.useState<number>(DEFAULT_AMOUNT);
    const [state, setState] = React.useState<PaymentState | null>(null);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isBusy, setIsBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [lastStatus, setLastStatus] = React.useState<string>('');
    const [phase, setPhase] = React.useState<PaymentPhase>('idle');

    React.useEffect(() => {
        return subscribeTopupOpen(() => {
            setIsOpen(true);
        });
    }, []);

    const qrAction = state?.actions.find((action) =>
        action.name === 'qr-code' || action.name === 'generate-qr-code' || action.name === 'generate-qr-code-v2'
    );
    const deeplinkAction = state?.actions.find((action) => action.name === 'deeplink-redirect');

    const logStatus = React.useCallback((next: string) => {
        if (next === lastStatus) return;
        setLastStatus(next);
        console.log(`[payment-ui] status -> ${next}`);
    }, [lastStatus]);

    const startPolling = React.useCallback((orderId: string) => {
        const startMs = Date.now();
        let stopped = false;
        let timer: number | null = null;

        const stop = () => {
            stopped = true;
            if (timer !== null) window.clearTimeout(timer);
        };

        const tick = async () => {
            if (stopped) return;
            const now = Date.now();
            if (now - startMs > POLL_TIMEOUT_MS) {
                logStatus('timeout');
                setError('Payment timed out');
                setPhase('failed');
                pushMoneyNotice({
                    kind: 'payment',
                    status: 'warning',
                    title: 'Pembayaran tertunda',
                    message: 'Pembayaran diproses, saldo mungkin terlambat beberapa detik. Saldo belum berubah.',
                    ctas: [
                        { label: 'Cek ulang saldo', onClick: () => void refreshBalance({ force: true }) }
                    ]
                });
                stop();
                return;
            }

            const result = await getPaymentStatus(orderId);
            if (!result.ok) {
                setError(result.error || 'Failed to fetch status');
            } else if (result.data && typeof result.data === 'object') {
                const status = String((result.data as { status?: string }).status || 'pending');
                setState((prev) => (prev ? { ...prev, status, lastUpdated: now } : prev));
                logStatus(status);

                if (status === 'settlement' || status === 'capture') {
                    setPhase('success');
                    pushMoneyNotice({
                        kind: 'payment',
                        status: 'success',
                        title: 'Pembayaran berhasil',
                        message: 'Saldo sudah bertambah.',
                        ctas: [
                            { label: 'Cek ulang saldo', onClick: () => void refreshBalance({ force: true }) }
                        ]
                    });
                    void refreshBalance();
                    onPaid?.(orderId);
                    stop();
                    return;
                }
                if (status === 'expire' || status === 'cancel' || status === 'deny' || status === 'failed') {
                    setPhase('failed');
                    pushMoneyNotice({
                        kind: 'payment',
                        status: 'warning',
                        title: 'Pembayaran gagal atau kedaluwarsa',
                        message: 'Saldo tidak berubah.',
                        ctas: [
                            { label: 'Coba lagi', onClick: () => setIsOpen(true) }
                        ]
                    });
                    stop();
                    return;
                }
            }

            const elapsed = now - startMs;
            const delay = elapsed < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
            timer = window.setTimeout(tick, delay);
        };

        timer = window.setTimeout(tick, POLL_FAST_MS);
        return stop;
    }, [logStatus, onPaid]);

    React.useEffect(() => {
        if (!state?.orderId) return;
        setPhase('pending');
        pushMoneyNotice({
            kind: 'payment',
            status: 'info',
            title: 'Menunggu pembayaran',
            message: 'Saldo akan diperbarui otomatis setelah pembayaran selesai.',
            ctas: [
                { label: 'Cek ulang saldo', onClick: () => void refreshBalance({ force: true }) }
            ]
        });
        const stop = startPolling(state.orderId);
        return () => stop();
    }, [state?.orderId, startPolling]);

    const handleCreate = async () => {
        setIsBusy(true);
        setError(null);
        setPhase('starting');
        try {
            const result = await createPaymentGopayQris(amount);
            if (!result.ok || !result.data || typeof result.data !== 'object') {
                setError(result.error || 'Payment request failed');
                setPhase('failed');
                const suppressNotice = shouldSuppressMoneyNoticeForNetworkFailure({
                    status: result.status,
                    error: result.error,
                    contentType: result.contentType
                });
                if (!suppressNotice) {
                    pushMoneyNotice({
                        kind: 'payment',
                        status: 'error',
                        title: 'Gagal memulai pembayaran',
                        message: 'Koneksi bermasalah. Saldo tidak berubah.',
                        ctas: [
                            { label: 'Coba lagi', onClick: () => handleCreate() }
                        ]
                    });
                }
                return;
            }
            const data = result.data as {
                order_id?: string;
                transaction_status?: string;
                actions?: PaymentAction[];
            };
            const orderId = data.order_id || '';
            if (!orderId) {
                setError('Missing order_id');
                setPhase('failed');
                return;
            }
            setState({
                orderId,
                status: data.transaction_status || 'pending',
                actions: Array.isArray(data.actions) ? data.actions : [],
                lastUpdated: Date.now(),
            });
            logStatus(data.transaction_status || 'pending');
        } catch (e) {
            setError(`Payment request failed: ${String(e)}`);
            setPhase('failed');
            const suppressNotice = shouldSuppressMoneyNoticeForNetworkFailure({ error: e });
            if (!suppressNotice) {
                pushMoneyNotice({
                    kind: 'payment',
                    status: 'error',
                    title: 'Gagal memulai pembayaran',
                    message: 'Koneksi bermasalah. Saldo tidak berubah.',
                    ctas: [
                        { label: 'Coba lagi', onClick: () => handleCreate() }
                    ]
                });
            }
        } finally {
            setIsBusy(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                style={LAUNCH_BUTTON_STYLE}
                onClick={() => setIsOpen(true)}
                onPointerDown={(e) => e.stopPropagation()}
            >
                Pay with QRIS
            </button>
        );
    }

    return (
        <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
            <div style={PANEL_HEADER_STYLE}>
                <div style={PANEL_TITLE_STYLE}>QRIS Payment</div>
                <button
                    type="button"
                    style={CLOSE_BUTTON_STYLE}
                    onClick={() => {
                        setIsOpen(false);
                        setPhase('cancelled');
                        pushMoneyNotice({
                            kind: 'payment',
                            status: 'warning',
                            title: 'Pembayaran dibatalkan',
                            message: 'Saldo tidak berubah.'
                        });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    Close
                </button>
            </div>

            <div style={FIELD_STYLE}>
                <div style={FIELD_LABEL_STYLE}>Amount (IDR)</div>
                <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={INPUT_STYLE}
                />
            </div>

            <button
                type="button"
                style={PRIMARY_BUTTON_STYLE}
                onClick={handleCreate}
                disabled={isBusy}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {isBusy ? 'Generating...' : 'Generate QRIS'}
            </button>

            <div style={STATUS_STYLE}>
                Status: {state?.status || 'idle'}
            </div>

            {error ? <div style={ERROR_STYLE}>{error}</div> : null}

            {phase === 'pending' ? (
                <div style={INFO_STYLE}>
                    Menunggu pembayaran. Saldo akan diperbarui otomatis setelah pembayaran selesai.
                </div>
            ) : null}
            {phase === 'failed' ? (
                <div style={INFO_STYLE}>
                    Pembayaran gagal atau tertunda. Saldo tidak berubah.
                </div>
            ) : null}
            {phase === 'cancelled' ? (
                <div style={INFO_STYLE}>
                    Pembayaran dibatalkan. Saldo tidak berubah.
                </div>
            ) : null}
            {phase === 'success' ? (
                <div style={INFO_STYLE}>
                    Pembayaran berhasil. Saldo bertambah.
                </div>
            ) : null}

            {qrAction?.url ? (
                <div style={QR_WRAPPER_STYLE}>
                    <img src={qrAction.url} alt="QR code" style={QR_IMAGE_STYLE} />
                </div>
            ) : (
                <div style={QR_PLACEHOLDER_STYLE}>QR will appear here</div>
            )}

            <button
                type="button"
                style={SECONDARY_BUTTON_STYLE}
                onClick={() => {
                    if (deeplinkAction?.url) window.location.href = deeplinkAction.url;
                }}
                disabled={!deeplinkAction?.url}
                onPointerDown={(e) => e.stopPropagation()}
            >
                Open Wallet
            </button>

            <button
                type="button"
                style={SECONDARY_BUTTON_STYLE}
                onClick={() => void refreshBalance({ force: true })}
                onPointerDown={(e) => e.stopPropagation()}
            >
                Cek ulang saldo
            </button>

            {state?.status === 'settlement' || state?.status === 'capture' ? (
                <div style={SUCCESS_STYLE}>Payment complete</div>
            ) : null}
        </div>
    );
};

const LAUNCH_BUTTON_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '24px',
    right: '124px',
    padding: '6px 12px',
    borderRadius: '10px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
    zIndex: 1900,
};

const PANEL_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '72px',
    right: '24px',
    width: '280px',
    background: '#0f1115',
    border: '1px solid #2b2f3a',
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 1900,
};

const PANEL_HEADER_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const PANEL_TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: '#8c93a6',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
};

const FIELD_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: '#5a6070',
    fontFamily: 'var(--font-ui)',
};

const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: 'none',
    background: '#2f6ee5',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};

const STATUS_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#8c93a6',
    fontFamily: 'var(--font-ui)',
};

const ERROR_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#ff8a8a',
    fontFamily: 'var(--font-ui)',
};

const SUCCESS_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#6fe1a2',
    fontFamily: 'var(--font-ui)',
};

const INFO_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#8c93a6',
    fontFamily: 'var(--font-ui)',
};

const QR_WRAPPER_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
};

const QR_IMAGE_STYLE: React.CSSProperties = {
    width: '180px',
    height: '180px',
    borderRadius: '12px',
    border: '1px solid #2b2f3a',
    background: '#0f1115',
    objectFit: 'contain',
};

const QR_PLACEHOLDER_STYLE: React.CSSProperties = {
    width: '100%',
    height: '180px',
    borderRadius: '12px',
    border: '1px dashed #2b2f3a',
    background: '#10141c',
    color: '#5a6070',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
