import React from 'react';
import { t } from '../i18n/t';
import plusIcon from '../assets/plus_icon.png';
import sendIcon from '../assets/send_icon_white.png';
import clipIcon from '../assets/clip_icon.png';

export const PromptCard: React.FC = () => {
    const [plusHover, setPlusHover] = React.useState(false);
    const [sendHover, setSendHover] = React.useState(false);
    const [showUploadPopup, setShowUploadPopup] = React.useState(false);
    const popupRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setShowUploadPopup(false);
            }
        };
        if (showUploadPopup) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUploadPopup]);

    return (
        <div style={CARD_STYLE}>
            <div style={CARD_INNER_STYLE}>
                <div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
                    <div style={PLACEHOLDER_LABEL_STYLE}>{t('onboarding.enterprompt.graph_preview_placeholder')}</div>
                </div>

                <div style={HEADLINE_STYLE}>
                    {t('onboarding.enterprompt.heading')}
                </div>

                <div style={INPUT_PILL_STYLE}>
                    <textarea
                        placeholder={t('onboarding.enterprompt.input_placeholder')}
                        style={INPUT_STYLE}
                        rows={6}
                        readOnly
                    />
                    <div style={ICON_ROW_STYLE}>
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                style={ICON_BUTTON_STYLE}
                                onMouseEnter={() => setPlusHover(true)}
                                onMouseLeave={() => setPlusHover(false)}
                                onClick={() => setShowUploadPopup(!showUploadPopup)}
                                title="Upload Document"
                            >
                                <img src={plusIcon} alt="Add" style={{ ...PLUS_ICON_STYLE, opacity: plusHover ? 1 : 0.6 }} />
                            </button>
                            {showUploadPopup && (
                                <div ref={popupRef} style={UPLOAD_POPUP_STYLE}>
                                    <button type="button" style={UPLOAD_POPUP_ITEM_STYLE}>
                                        <img src={clipIcon} alt="" style={CLIP_ICON_STYLE} />
                                        <span>Upload document</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            style={ICON_BUTTON_STYLE}
                            onMouseEnter={() => setSendHover(true)}
                            onMouseLeave={() => setSendHover(false)}
                        >
                            <img src={sendIcon} alt="Send" style={{ ...SEND_ICON_STYLE, opacity: sendHover ? 0.8 : 0.4 }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CARD_STYLE: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#06060A',
    color: '#e7e7e7',
};

const CARD_INNER_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '48px',
    maxWidth: '720px',
    width: '100%',
    padding: '0 24px',
    boxSizing: 'border-box',
};

const HEADLINE_STYLE: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    marginTop: 20,
    marginBottom: -20,
};

const GRAPH_PREVIEW_PLACEHOLDER_STYLE: React.CSSProperties = {
    width: '100%',
    height: '200px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(255, 255, 255, 0.02)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PLACEHOLDER_LABEL_STYLE: React.CSSProperties = {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.35)',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const INPUT_PILL_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '600px',
    padding: '16px 20px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
};

const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#e7e7e7',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
};

const ICON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

const ICON_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PLUS_ICON_STYLE: React.CSSProperties = {
    width: '15px',
    height: '15px',
    opacity: 0.6,
};

const SEND_ICON_STYLE: React.CSSProperties = {
    width: '28px',
    height: '28px',
    opacity: 0.4,
};

// Popup scale: adjust to make popup smaller/larger (1.0 = base, 0.8 = 20% smaller)
const POPUP_SCALE = 0.85;

const UPLOAD_POPUP_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: `${8 * POPUP_SCALE}px`,
    padding: `${8 * POPUP_SCALE}px 0`,
    borderRadius: `${10 * POPUP_SCALE}px`,
    background: '#1a1a1f',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    minWidth: `${180 * POPUP_SCALE}px`,
    zIndex: 100,
};

const UPLOAD_POPUP_ITEM_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${10 * POPUP_SCALE}px`,
    width: '100%',
    padding: `${10 * POPUP_SCALE}px ${16 * POPUP_SCALE}px`,
    background: 'transparent',
    border: 'none',
    color: '#e7e7e7',
    fontSize: `${14 * POPUP_SCALE}px`,
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    cursor: 'pointer',
};

const CLIP_ICON_STYLE: React.CSSProperties = {
    width: `${16 * POPUP_SCALE}px`,
    height: `${16 * POPUP_SCALE}px`,
    opacity: 0.7,
};
