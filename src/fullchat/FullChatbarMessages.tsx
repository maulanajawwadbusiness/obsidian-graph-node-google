import React from 'react';
import type { FullChatMessage } from './fullChatTypes';
import { StreamingDots } from './FullChatbarStreaming';
import {
    EMPTY_STATE_STYLE,
    JUMP_TO_LATEST_STYLE,
    MESSAGES_CONTAINER_STYLE,
    MESSAGES_WRAPPER_STYLE,
    VOID,
} from './FullChatbarStyles';
import { t } from '../i18n/t';

export type FullChatbarMessagesProps = {
    messages: FullChatMessage[];
    focusLabel: string | null;
    showJumpToLatest: boolean;
    messagesContainerRef: React.RefObject<HTMLDivElement>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    onJumpToLatest: () => void;
    getMessageStyle: (msg: FullChatMessage, prevMsg: FullChatMessage | undefined) => React.CSSProperties;
};

export const FullChatbarMessages: React.FC<FullChatbarMessagesProps> = ({
    messages,
    focusLabel,
    showJumpToLatest,
    messagesContainerRef,
    messagesEndRef,
    onScroll,
    onJumpToLatest,
    getMessageStyle,
}) => {
    if (messages.length === 0) {
        return (
            <div style={EMPTY_STATE_STYLE}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: `1px solid ${VOID.energySubtle}`,
                    boxShadow: `0 0 30px ${VOID.energyFaint}, inset 0 0 20px ${VOID.energyFaint}`,
                    marginBottom: '8px',
                }} />
                <div style={{
                    color: VOID.textSoft,
                    fontSize: '14px',
                }}>
                    {focusLabel ? t('fullChat.emptyStateThinking', { label: focusLabel }) : t('fullChat.emptyStateDesc')}
                </div>
                <div style={{
                    color: VOID.textDim,
                    fontSize: '12px',
                    maxWidth: '220px',
                }}>
                    {focusLabel ? t('fullChat.emptyStateTrace') : t('fullChat.emptyStateTraceDefault')}
                </div>
            </div>
        );
    }

    return (
        <div style={MESSAGES_WRAPPER_STYLE} className="arnvoid-scroll-fades">
            <div
                ref={messagesContainerRef}
                style={MESSAGES_CONTAINER_STYLE}
                className="arnvoid-scroll"
                onScroll={onScroll}
            >
                {messages.map((msg, i) => (
                    <div
                        key={msg.timestamp}
                        style={getMessageStyle(msg, messages[i - 1])}
                    >
                        {msg.text}
                        {msg.status === 'streaming' && <StreamingDots />}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {showJumpToLatest && (
                <button
                    style={JUMP_TO_LATEST_STYLE}
                    onClick={onJumpToLatest}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                >
                    <span>↓</span>
                    {t('fullChat.jumpToLatest')}
                </button>
            )}
        </div>
    );
};
