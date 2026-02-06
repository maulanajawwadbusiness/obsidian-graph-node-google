import { useSyncExternalStore } from 'react';

export type MoneyNoticeKind = 'payment' | 'balance' | 'deduction';
export type MoneyNoticeStatus = 'info' | 'warning' | 'success' | 'error';

export type MoneyNoticeCta = {
    label: string;
    onClick: () => void;
};

export type MoneyNotice = {
    id: string;
    kind: MoneyNoticeKind;
    status: MoneyNoticeStatus;
    title: string;
    message: string;
    ctas?: MoneyNoticeCta[];
    createdAt: number;
};

const listeners = new Set<() => void>();
let notices: MoneyNotice[] = [];

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setNotices(next: MoneyNotice[]) {
    notices = next;
    emitChange();
}

export function useMoneyNotices(): MoneyNotice[] {
    return useSyncExternalStore(subscribeMoneyNotices, getMoneyNotices, getMoneyNotices);
}

export function getMoneyNotices(): MoneyNotice[] {
    return notices;
}

export function subscribeMoneyNotices(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function pushMoneyNotice(notice: Omit<MoneyNotice, 'id' | 'createdAt'>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next: MoneyNotice = {
        id,
        createdAt: Date.now(),
        ...notice
    };
    setNotices([next, ...notices].slice(0, 3));
    return id;
}

export function dismissMoneyNotice(id: string) {
    setNotices(notices.filter((notice) => notice.id !== id));
}

export function clearMoneyNotices() {
    setNotices([]);
}
