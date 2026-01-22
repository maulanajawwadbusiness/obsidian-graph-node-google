import React from 'react';
import { NodePopup } from './NodePopup';
import { MiniChatbar } from './MiniChatbar';
import { PopupOverlayContainer } from './PopupOverlayContainer';
import { usePopup } from './PopupStore';

/**
 * Popup Portal - Renders popup system using shared overlay container
 * 
 * This now uses PopupOverlayContainer for consistent portal management.
 * Future: Can be extended to support seed popup mode.
 */

export const PopupPortal: React.FC = () => {
    const { isOpen, chatbarOpen, messages, sendMessage, closeChatbar } = usePopup();

    // Don't render portal if nothing is open
    if (!isOpen && !chatbarOpen) {
        return null;
    }

    return (
        <PopupOverlayContainer>
            {isOpen && <NodePopup />}
            {chatbarOpen && (
                <MiniChatbar
                    messages={messages}
                    onSend={sendMessage}
                    onClose={closeChatbar}
                />
            )}
        </PopupOverlayContainer>
    );
};
