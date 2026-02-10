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

import { PhysicsEngine } from '../physics/engine';

interface PopupPortalProps {
    trackNode?: (nodeId: string) => { x: number; y: number; radius: number } | null;
    engineRef?: React.RefObject<PhysicsEngine>;
}

export const PopupPortal: React.FC<PopupPortalProps> = ({ trackNode, engineRef }) => {
    const { isOpen, chatbarOpen, messages, sendMessage, closeChatbar } = usePopup();

    // Don't render portal if nothing is open
    if (!isOpen && !chatbarOpen) {
        return null;
    }

    return (
        <PopupOverlayContainer>
            {isOpen && <NodePopup trackNode={trackNode} engineRef={engineRef} />}
            {chatbarOpen && (
                <MiniChatbar
                    messages={messages}
                    onSend={(text) => sendMessage(text, 'mini-chat')}
                    onClose={closeChatbar}
                />
            )}
        </PopupOverlayContainer>
    );
};
