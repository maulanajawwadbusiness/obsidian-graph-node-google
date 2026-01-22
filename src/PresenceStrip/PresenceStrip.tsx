import type { RefObject } from 'react'
import documentViewerIcon from '../assets/document_viewer_icon.png'
import './PresenceStrip.css'

type ViewerMode = 'presence' | 'peek' | 'open'
type DocumentState = 'empty' | 'loaded' | 'warning'

interface PresenceStripProps {
    viewerMode: ViewerMode
    documentState: DocumentState
    proximity: 'far' | 'near' | 'close'
    onHover: (isHovering: boolean) => void
    onClick: () => void
    tabRef: RefObject<HTMLButtonElement>
}

export function PresenceStrip({
    viewerMode,
    documentState,
    proximity,
    onHover,
    onClick,
    tabRef,
}: PresenceStripProps) {
    const tabClasses = [
        'bookmark-tab',
        `mode-${viewerMode}`,
        `doc-${documentState}`,
        `proximity-${proximity}`,
    ].join(' ')

    const containerClasses = `presence-strip-container ${viewerMode === 'open' ? 'mode-open' : ''}`

    return (
        <div className={containerClasses}>
            {/* The bookmark tab */}
            <button
                className={tabClasses}
                ref={tabRef}
                onMouseEnter={() => onHover(true)}
                onMouseLeave={() => onHover(false)}
                onClick={onClick}
                aria-label={viewerMode === 'open' ? 'Close document panel' : 'Open document panel'}
                aria-expanded={viewerMode === 'open'}
                title="Open Document Viewer"
            >
                {/* Document icon */}
                <img
                    src={documentViewerIcon}
                    alt=""
                    className="tab-icon"
                    draggable={false}
                />

                {/* Feathered edge overlay */}
                <div className="tab-feather" aria-hidden="true" />
            </button>
        </div>
    )
}
