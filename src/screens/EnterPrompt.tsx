import React from 'react';
import { LoginOverlay } from '../auth/LoginOverlay';
import { useAuth } from '../auth/AuthProvider';
import { PromptCard } from '../components/PromptCard';
import { PaymentGopayPanel } from '../components/PaymentGopayPanel';
import { SHOW_ENTERPROMPT_PAYMENT_PANEL } from '../config/onboardingUiFlags';
import uploadOverlayIcon from '../assets/upload_overlay_icon.png';
import errorIcon from '../assets/error_icon.png';

const LOGIN_OVERLAY_ENABLED = true;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.markdown', '.txt'];
const LEFT_RAIL_GUTTER_PX = 35;

const isFileSupported = (file: File): boolean => {
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext ? ACCEPTED_EXTENSIONS.includes(ext) : false;
};

type EnterPromptProps = {
    onEnter: () => void;
    onBack: () => void;
    onSkip: () => void;
    onOverlayOpenChange?: (open: boolean) => void;
    onSubmitPromptText?: (text: string) => void;
    onSubmitPromptFile?: (file: File) => void;
    analysisErrorMessage?: string | null;
    onDismissAnalysisError?: () => void;
};

export const EnterPrompt: React.FC<EnterPromptProps> = ({
    onEnter,
    onBack,
    onSkip,
    onOverlayOpenChange,
    onSubmitPromptText,
    onSubmitPromptFile,
    analysisErrorMessage = null,
    onDismissAnalysisError
}) => {
    const { user } = useAuth();
    const [isOverlayHidden, setIsOverlayHidden] = React.useState(false);
    const [promptText, setPromptText] = React.useState('');
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showUnsupportedError, setShowUnsupportedError] = React.useState(false);
    const loginOverlayOpen = LOGIN_OVERLAY_ENABLED && !user && !isOverlayHidden;
    const dragCounterRef = React.useRef(0);

    const handlePromptSubmit = React.useCallback((submittedText: string) => {
        const trimmed = submittedText.trim();
        if (trimmed) {
            onSubmitPromptText?.(trimmed);
            console.log(`[enterprompt] submitted_text_len=${trimmed.length}`);
            onEnter();
            return;
        }

        const firstFile = attachedFiles[0];
        if (!firstFile) return;
        onSubmitPromptFile?.(firstFile);
        if (import.meta.env.DEV) {
            console.log(`[enterprompt] submitted_file name=${firstFile.name} size=${firstFile.size}`);
        }
        onEnter();
    }, [attachedFiles, onEnter, onSubmitPromptFile, onSubmitPromptText]);

    const handleRemoveFile = React.useCallback((index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleDragEnter = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, []);

    const handleDragOver = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const attachFromFiles = React.useCallback((files: File[]) => {
        const lastFile = files.length > 0 ? files[files.length - 1] : null;
        if (!lastFile) return;

        if (isFileSupported(lastFile)) {
            setAttachedFiles([lastFile]);
            return;
        }

        setShowUnsupportedError(true);
        setTimeout(() => setShowUnsupportedError(false), 3000);
    }, []);

    const handleDrop = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);
        attachFromFiles(Array.from(e.dataTransfer.files));
    }, [attachFromFiles]);

    React.useEffect(() => {
        onOverlayOpenChange?.(loginOverlayOpen);
    }, [loginOverlayOpen, onOverlayOpenChange]);

    return (
        <div
            style={ROOT_STYLE}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <PromptCard
                value={promptText}
                onChange={setPromptText}
                onSubmit={handlePromptSubmit}
                attachedFiles={attachedFiles}
                canSubmitWithoutText={attachedFiles.length > 0}
                onRemoveFile={handleRemoveFile}
                onPickFiles={(files) => attachFromFiles(files)}
                statusMessage={analysisErrorMessage ? { kind: 'error', text: analysisErrorMessage } : null}
                onDismissStatusMessage={onDismissAnalysisError}
            />
            {SHOW_ENTERPROMPT_PAYMENT_PANEL ? <PaymentGopayPanel /> : null}

            {/* Drag overlay */}
            {isDragging && (
                <div style={DRAG_OVERLAY_STYLE}>
                    <div style={DRAG_OVERLAY_CONTENT_STYLE}>
                        <img src={uploadOverlayIcon} alt="" style={DRAG_OVERLAY_ICON_STYLE} />
                        <div style={DRAG_OVERLAY_HEADER_STYLE}>Add Document</div>
                        <div style={DRAG_OVERLAY_DESC_STYLE}>Drop document here to begin to analyze it</div>
                    </div>
                </div>
            )}

            {/* Unsupported file error overlay */}
            {showUnsupportedError && (
                <div style={ERROR_OVERLAY_STYLE}>
                    <div style={ERROR_OVERLAY_CONTENT_STYLE}>
                        <img src={errorIcon} alt="" style={ERROR_OVERLAY_ICON_STYLE} />
                        <div style={ERROR_OVERLAY_TEXT_STYLE}>
                            Unsupported file format
                        </div>
                        <div style={ERROR_OVERLAY_DESC_STYLE}>
                            We only support PDF, DOCX, MD, and TXT files.
                        </div>
                    </div>
                </div>
            )}

            {/* Login overlay disabled for now */}
            {LOGIN_OVERLAY_ENABLED && <LoginOverlay
                open={loginOverlayOpen}
                onContinue={onEnter}
                onBack={onBack}
                onSkip={onSkip}
                onHide={() => setIsOverlayHidden(true)}
            />}

        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    background: '#06060A',
    color: '#e7e7e7',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
    position: 'relative',
    boxSizing: 'border-box',
    paddingLeft: `${LEFT_RAIL_GUTTER_PX}px`,
};

const DRAG_OVERLAY_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
};

const DRAG_OVERLAY_CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const DRAG_OVERLAY_ICON_STYLE: React.CSSProperties = {
    width: '64px',
    height: '64px',
    opacity: 0.7,
};

const DRAG_OVERLAY_HEADER_STYLE: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 300,
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
};

const DRAG_OVERLAY_DESC_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 300,
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: 'var(--font-ui)',
};

const ERROR_OVERLAY_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
};

const ERROR_OVERLAY_CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

// Resize knob for error overlay icon
const ERROR_OVERLAY_ICON_SIZE = 32;

const ERROR_OVERLAY_ICON_STYLE: React.CSSProperties = {
    width: `${ERROR_OVERLAY_ICON_SIZE}px`,
    height: `${ERROR_OVERLAY_ICON_SIZE}px`,
};

const ERROR_OVERLAY_TEXT_STYLE: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 300,
    color: 'rgba(255, 100, 100, 0.9)',
    fontFamily: 'var(--font-ui)',
};

const ERROR_OVERLAY_DESC_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 300,
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: 'var(--font-ui)',
};

