import React from 'react';
import { t } from '../i18n/t';
import plusIcon from '../assets/plus_icon.png';
import sendIcon from '../assets/send_icon_white.png';
import clipIcon from '../assets/clip_icon.png';
import fileMiniIcon from '../assets/file_mini_icon.png';
import { useTooltip } from '../ui/tooltip/useTooltip';
import { SampleGraphPreview } from './SampleGraphPreview';

// Toggle: true = block submit when text is empty, false = allow empty submit path.
const HARD_BLOCK_EMPTY_TEXT_SUBMIT = false;

type PromptCardProps = {
    value?: string;
    onChange?: (text: string) => void;
    onSubmit?: (text: string) => void;
    disabled?: boolean;
    attachedFiles?: File[];
    canSubmitWithoutText?: boolean;
    onRemoveFile?: (index: number) => void;
    onPickFiles?: (files: File[]) => void;
};

export const PromptCard: React.FC<PromptCardProps> = ({
    value = '',
    onChange = () => { },
    onSubmit = () => { },
    disabled = false,
    attachedFiles = [],
    canSubmitWithoutText = false,
    onRemoveFile = () => { },
    onPickFiles = () => { },
}) => {
    const [plusHover, setPlusHover] = React.useState(false);
    const [sendHover, setSendHover] = React.useState(false);
    const [showUploadPopup, setShowUploadPopup] = React.useState(false);
    const [uploadMenuHover, setUploadMenuHover] = React.useState(false);
    const [inputText, setInputText] = React.useState(value);
    const popupRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const removeFileTooltip = useTooltip('Remove file');
    const uploadDocumentTooltip = useTooltip('Upload Document', { disabled });

    React.useEffect(() => {
        setInputText(value);
    }, [value]);

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

    const handleSubmit = React.useCallback(() => {
        if (disabled) return;
        const trimmed = inputText.trim();
        if (trimmed.length > 0) {
            onSubmit(trimmed);
            return;
        }
        if (HARD_BLOCK_EMPTY_TEXT_SUBMIT) return;
        if (!canSubmitWithoutText) return;
        onSubmit('');
    }, [canSubmitWithoutText, disabled, inputText, onSubmit]);

    const handleInputChange = React.useCallback((nextText: string) => {
        setInputText(nextText);
        onChange(nextText);
    }, [onChange]);

    const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <div style={CARD_STYLE}>
            <div style={CARD_INNER_STYLE}>
                <div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
                    <SampleGraphPreview />
                </div>

                <div style={HEADLINE_STYLE}>
                    {t('onboarding.enterprompt.heading')}
                </div>

                <div style={INPUT_PILL_STYLE}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.md,.markdown,.txt"
                        multiple={true}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            if (files.length > 0) {
                                onPickFiles(files);
                            }
                            e.currentTarget.value = '';
                        }}
                    />
                    {attachedFiles.length > 0 && (
                        <>
                            <div style={FILE_CHIPS_ROW_STYLE}>
                                {attachedFiles.map((file, index) => (
                                    <div key={`${file.name}-${index}`} style={FILE_CHIP_STYLE}>
                                        <img src={fileMiniIcon} alt="" style={FILE_CHIP_ICON_STYLE} />
                                        <span style={FILE_CHIP_NAME_STYLE}>{file.name}</span>
                                        <button
                                            {...removeFileTooltip.getAnchorProps({
                                                type: 'button',
                                                style: FILE_CHIP_DISMISS_STYLE,
                                                onClick: () => onRemoveFile(index),
                                            })}
                                        >
                                            x
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    <textarea
                        placeholder={t('onboarding.enterprompt.input_placeholder')}
                        style={INPUT_STYLE}
                        rows={6}
                        value={inputText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        disabled={disabled}
                    />
                    <div style={ICON_ROW_STYLE}>
                        <div style={{ position: 'relative' }}>
                            <button
                                {...uploadDocumentTooltip.getAnchorProps({
                                    type: 'button',
                                    style: ICON_BUTTON_STYLE,
                                    onMouseEnter: () => setPlusHover(true),
                                    onMouseLeave: () => setPlusHover(false),
                                    onClick: () => setShowUploadPopup(!showUploadPopup),
                                })}
                                disabled={disabled}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        ...PLUS_ICON_STYLE,
                                        backgroundColor: '#D7F5FF',
                                        WebkitMaskImage: `url(${plusIcon})`,
                                        maskImage: `url(${plusIcon})`,
                                        opacity: plusHover ? 1 : 0.6
                                    }}
                                />
                            </button>
                            {showUploadPopup && (
                                <div
                                    ref={popupRef}
                                    style={UPLOAD_POPUP_STYLE}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerUp={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onWheelCapture={(e) => e.stopPropagation()}
                                    onWheel={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        style={UPLOAD_POPUP_ITEM_STYLE}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onPointerUp={(e) => e.stopPropagation()}
                                        onWheelCapture={(e) => e.stopPropagation()}
                                        onWheel={(e) => e.stopPropagation()}
                                        onMouseEnter={() => setUploadMenuHover(true)}
                                        onMouseLeave={() => setUploadMenuHover(false)}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowUploadPopup(false);
                                            fileInputRef.current?.click();
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                ...UPLOAD_POPUP_ITEM_HOVER_PLATE_STYLE,
                                                backgroundColor: uploadMenuHover ? 'rgba(215, 245, 255, 0.14)' : 'transparent',
                                            }}
                                        />
                                        <span style={UPLOAD_POPUP_ITEM_CONTENT_STYLE}>
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    ...CLIP_ICON_STYLE,
                                                    backgroundColor: '#D7F5FF',
                                                    WebkitMaskImage: `url(${clipIcon})`,
                                                    maskImage: `url(${clipIcon})`
                                                }}
                                            />
                                            <span>Upload document</span>
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            style={ICON_BUTTON_STYLE}
                            onMouseEnter={() => setSendHover(true)}
                            onMouseLeave={() => setSendHover(false)}
                            onClick={handleSubmit}
                            disabled={disabled}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    ...SEND_ICON_STYLE,
                                    backgroundColor: '#D7F5FF',
                                    WebkitMaskImage: `url(${sendIcon})`,
                                    maskImage: `url(${sendIcon})`,
                                    opacity: sendHover ? 0.8 : 0.4
                                }}
                            />
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
    fontWeight: 300,
    lineHeight: 1.4,
    textAlign: 'center',
    color: '#D7F5FF',
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
    display: 'inline-block',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    opacity: 0.6,
};

const SEND_ICON_STYLE: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'inline-block',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    opacity: 0.4,
};

// Popup scale: adjust to make popup smaller/larger (1.0 = base, 0.8 = 20% smaller)
const POPUP_SCALE = 0.85;
const UPLOAD_POPUP_HOVER_EDGE_GAP_X_PX = 10;
const UPLOAD_POPUP_HOVER_EDGE_GAP_Y_PX = 3;

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
    overflow: 'hidden',
};

const UPLOAD_POPUP_ITEM_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${10 * POPUP_SCALE}px`,
    width: '100%',
    padding: `${10 * POPUP_SCALE}px ${16 * POPUP_SCALE}px`,
    background: 'transparent',
    border: 'none',
    color: '#b9d0d8',
    fontSize: `${14 * POPUP_SCALE}px`,
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: `${8 * POPUP_SCALE}px`,
    position: 'relative',
    overflow: 'hidden',
};

const UPLOAD_POPUP_ITEM_HOVER_PLATE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: `${UPLOAD_POPUP_HOVER_EDGE_GAP_Y_PX}px`,
    right: `${UPLOAD_POPUP_HOVER_EDGE_GAP_X_PX}px`,
    bottom: `${UPLOAD_POPUP_HOVER_EDGE_GAP_Y_PX}px`,
    left: `${UPLOAD_POPUP_HOVER_EDGE_GAP_X_PX}px`,
    borderRadius: `${8 * POPUP_SCALE}px`,
    transition: 'background-color 100ms ease',
    pointerEvents: 'none',
    zIndex: 0,
};

const UPLOAD_POPUP_ITEM_CONTENT_STYLE: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${10 * POPUP_SCALE}px`,
};

const CLIP_ICON_STYLE: React.CSSProperties = {
    width: `${16 * POPUP_SCALE}px`,
    height: `${16 * POPUP_SCALE}px`,
    display: 'inline-block',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    opacity: 0.7,
};

// File chips styles - "whisper chip" ghost styling
const FILE_CHIPS_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
};

const FILE_CHIP_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    animation: 'fadeIn 0.2s ease',
};

const FILE_CHIP_ICON_STYLE: React.CSSProperties = {
    width: '14px',
    height: '14px',
    opacity: 0.5,
};

const FILE_CHIP_NAME_STYLE: React.CSSProperties = {
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    color: 'rgba(255, 255, 255, 0.55)',
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const FILE_CHIP_DISMISS_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    marginLeft: '2px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.3)',
    cursor: 'pointer',
    lineHeight: 1,
    transition: 'color 0.15s ease',
};
