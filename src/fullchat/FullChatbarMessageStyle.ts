import type React from 'react';
import type { FullChatMessage } from './fullChatTypes';
import { MESSAGE_STYLE_AI, MESSAGE_STYLE_USER } from './FullChatbarStyles';

export const getMessageStyle = (
    msg: FullChatMessage,
    prevMsg: FullChatMessage | undefined
): React.CSSProperties => {
    const base = msg.role === 'user' ? MESSAGE_STYLE_USER : MESSAGE_STYLE_AI;
    const isNewTurn = prevMsg && prevMsg.role === 'ai' && msg.role === 'user';

    if (!isNewTurn) return base;

    return {
        ...base,
        marginTop: '12px',
    };
};
