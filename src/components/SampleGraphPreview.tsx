import React from 'react';
import { GraphPhysicsPlayground } from '../playground/GraphPhysicsPlayground';

const PREVIEW_ROOT_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
};

const PREVIEW_FALLBACK_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
};

type PreviewErrorBoundaryState = {
    hasError: boolean;
};

class PreviewErrorBoundary extends React.Component<React.PropsWithChildren, PreviewErrorBoundaryState> {
    state: PreviewErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): PreviewErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: unknown): void {
        console.error('[SampleGraphPreview] runtime mount failed', error);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return <div style={PREVIEW_FALLBACK_STYLE}>sample graph initializing...</div>;
        }
        return this.props.children;
    }
}

export const SampleGraphPreview: React.FC = () => {
    return (
        <div data-arnvoid-graph-preview-root="1" style={PREVIEW_ROOT_STYLE}>
            <PreviewErrorBoundary>
                <GraphPhysicsPlayground
                    pendingAnalysisPayload={null}
                    onPendingAnalysisConsumed={() => {}}
                    enableDebugSidebar={false}
                />
            </PreviewErrorBoundary>
        </div>
    );
};
