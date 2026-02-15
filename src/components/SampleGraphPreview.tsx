import React from 'react';
import { GraphPhysicsPlayground } from '../playground/GraphPhysicsPlayground';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { PortalScopeProvider } from './portalScope/PortalScopeContext';
import sampleGraphPreviewExport from '../samples/sampleGraphPreview.export.json';
import { parseSavedInterfaceRecord } from '../store/savedInterfacesStore';
import { devExportToSavedInterfaceRecordV1 } from '../lib/devExport/devExportToSavedInterfaceRecord';
import { parseDevInterfaceExportV1 } from '../lib/devExport/devExportTypes';
import {
    acquireGraphRuntimeLease,
    releaseGraphRuntimeLease,
    type GraphRuntimeOwner,
} from '../runtime/graphRuntimeLease';
import {
    SAMPLE_GRAPH_PREVIEW_ROOT_ATTR,
    SAMPLE_GRAPH_PREVIEW_ROOT_VALUE
} from './sampleGraphPreviewSeams';

const PREVIEW_ROOT_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 'inherit',
};

const PREVIEW_SURFACE_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
};

const PREVIEW_PORTAL_ROOT_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 20,
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

type LeaseState =
    | { phase: 'checking' }
    | { phase: 'allowed'; token: string }
    | { phase: 'denied'; activeOwner: GraphRuntimeOwner; activeInstanceId: string };

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
    const previewRootMarker: Record<string, string> = {
        [SAMPLE_GRAPH_PREVIEW_ROOT_ATTR]: SAMPLE_GRAPH_PREVIEW_ROOT_VALUE,
    };
    const [portalRootEl, setPortalRootEl] = React.useState<HTMLDivElement | null>(null);
    const instanceIdRef = React.useRef(
        `prompt-preview:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
    );
    const [leaseState, setLeaseState] = React.useState<LeaseState>({ phase: 'checking' });
    const sampleLoadState = React.useMemo(() => {
        const parsedDev = parseDevInterfaceExportV1(sampleGraphPreviewExport);
        if (!parsedDev) {
            return { record: null, error: 'invalid_dev_export_payload' } as const;
        }
        try {
            const candidateRecord = devExportToSavedInterfaceRecordV1(parsedDev, { preview: true });
            const parsedRecord = parseSavedInterfaceRecord(candidateRecord);
            if (!parsedRecord) {
                return { record: null, error: 'invalid_saved_interface_payload' } as const;
            }
            return { record: parsedRecord, error: null } as const;
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'adapter_failed';
            return { record: null, error: reason } as const;
        }
    }, []);
    const sampleLoadError = sampleLoadState.error !== null;

    React.useLayoutEffect(() => {
        const result = acquireGraphRuntimeLease('prompt-preview', instanceIdRef.current);
        if (result.ok) {
            setLeaseState({ phase: 'allowed', token: result.token });
            return () => {
                releaseGraphRuntimeLease(result.token);
            };
        }
        setLeaseState({
            phase: 'denied',
            activeOwner: result.activeOwner,
            activeInstanceId: result.activeInstanceId,
        });
        return undefined;
    }, []);

    const isLeaseDenied = leaseState.phase === 'denied';
    const canMountRuntime = leaseState.phase === 'allowed' && portalRootEl && sampleLoadState.record;

    return (
        <div {...previewRootMarker} style={PREVIEW_ROOT_STYLE}>
            <div ref={setPortalRootEl} data-arnvoid-preview-portal-root="1" style={PREVIEW_PORTAL_ROOT_STYLE} />
            <PreviewErrorBoundary>
                <div style={PREVIEW_SURFACE_STYLE}>
                    {canMountRuntime ? (
                        <PortalScopeProvider mode="container" portalRootEl={portalRootEl}>
                            <TooltipProvider>
                                <GraphPhysicsPlayground
                                    pendingAnalysisPayload={null}
                                    onPendingAnalysisConsumed={() => {}}
                                    pendingLoadInterface={sampleLoadState.record}
                                    onPendingLoadInterfaceConsumed={() => {}}
                                    enableDebugSidebar={false}
                                />
                            </TooltipProvider>
                        </PortalScopeProvider>
                    ) : isLeaseDenied ? (
                        <div style={PREVIEW_FALLBACK_STYLE}>
                            preview paused (active: {leaseState.activeOwner})
                        </div>
                    ) : sampleLoadError ? (
                        <div style={PREVIEW_FALLBACK_STYLE}>sample graph invalid payload ({sampleLoadState.error})</div>
                    ) : (
                        <div style={PREVIEW_FALLBACK_STYLE}>sample graph initializing...</div>
                    )}
                </div>
            </PreviewErrorBoundary>
        </div>
    );
};
