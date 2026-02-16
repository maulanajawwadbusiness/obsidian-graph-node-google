import React from 'react';
import { GraphPhysicsPlayground } from '../playground/GraphPhysicsPlayground';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { PortalScopeProvider } from './portalScope/PortalScopeContext';
import type { SavedInterfaceRecordV1 } from '../store/savedInterfacesStore';
import { devExportToSavedInterfaceRecordV1 } from '../lib/devExport/devExportToSavedInterfaceRecord';
import { parseDevInterfaceExportStrict } from '../lib/devExport/parseDevInterfaceExportStrict';
import { parseSavedInterfaceRecordForPreview } from '../lib/devExport/parseSavedInterfaceRecordForPreview';
import { validateSampleGraphSemantic } from '../lib/preview/validateSampleGraphSemantic';
import { warnIfInvalidCurrentSamplePreviewExportOnce } from '../lib/preview/validateCurrentSamplePreviewExport';
import {
    PREVIEW_VALIDATION_ERROR_CODE,
    createValidationError,
    type ValidationError,
} from '../lib/validation/errors';
import { chainResult, err, ok, type Result } from '../lib/validation/result';
import {
    acquireGraphRuntimeLease,
    assertActiveLeaseOwner,
    isGraphRuntimeLeaseTokenActive,
    releaseGraphRuntimeLease,
    subscribeGraphRuntimeLease,
    type GraphRuntimeOwner,
} from '../runtime/graphRuntimeLease';
import { trackResource, warnIfGraphRuntimeResourcesUnbalanced } from '../runtime/resourceTracker';
import {
    isInsideSampleGraphPreviewOverlayInteractiveRoot,
    SAMPLE_GRAPH_PREVIEW_ROOT_ATTR,
    SAMPLE_GRAPH_PREVIEW_ROOT_VALUE,
    SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR,
    SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE
} from './sampleGraphPreviewSeams';
import {
    GraphViewportProvider,
    type GraphViewport,
} from '../runtime/viewport/graphViewport';
import { useResizeObserverViewport } from '../runtime/viewport/useResizeObserverViewport';

const PREVIEW_ROOT_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 'inherit',
    overscrollBehavior: 'contain',
    touchAction: 'none',
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

const PREVIEW_ERROR_WRAP_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: '4px',
    padding: '8px 10px',
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '11px',
    fontFamily: 'var(--font-ui)',
    lineHeight: 1.35,
    overflow: 'hidden',
};

const PREVIEW_ERROR_TITLE_STYLE: React.CSSProperties = {
    textTransform: 'uppercase',
    letterSpacing: '0.35px',
    color: 'rgba(255, 170, 170, 0.92)',
    fontWeight: 600,
};

const PREVIEW_ERROR_LINE_STYLE: React.CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

type PreviewErrorBoundaryState = {
    hasError: boolean;
};

type LeaseState =
    | { phase: 'checking' }
    | { phase: 'allowed'; token: string }
    | { phase: 'paused'; reason: 'lost_lease' | 'denied' }
    | { phase: 'denied'; activeOwner: GraphRuntimeOwner; activeInstanceId: string };

type SampleLoadSuccess = {
    record: SavedInterfaceRecordV1;
};

type PreviewLeaseDebugCounters = {
    lostLeaseUnmountCount: number;
    reacquireAttemptCount: number;
    reacquireSuccessCount: number;
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
    const stopPropagation = React.useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
    }, []);
    const previewRootMarker: Record<string, string> = {
        [SAMPLE_GRAPH_PREVIEW_ROOT_ATTR]: SAMPLE_GRAPH_PREVIEW_ROOT_VALUE,
    };
    const previewRootRef = React.useRef<HTMLDivElement | null>(null);
    const [portalRootEl, setPortalRootEl] = React.useState<HTMLDivElement | null>(null);
    const boxedViewportFallback = React.useMemo<GraphViewport>(() => ({
        mode: 'boxed',
        source: 'unknown',
        width: 1,
        height: 1,
        dpr: 1,
        boundsRect: null,
    }), []);
    const boxedViewport = useResizeObserverViewport(previewRootRef, {
        mode: 'boxed',
        source: 'container',
        fallbackViewport: boxedViewportFallback,
    });
    const [sampleExportPayload, setSampleExportPayload] = React.useState<unknown | null>(null);
    const [sampleImportError, setSampleImportError] = React.useState<string | null>(null);
    const instanceIdRef = React.useRef(
        `prompt-preview:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
    );
    const [leaseState, setLeaseState] = React.useState<LeaseState>({ phase: 'checking' });
    const activeLeaseTokenRef = React.useRef<string | null>(null);
    const leaseStateRef = React.useRef<LeaseState>({ phase: 'checking' });
    const lastReacquireEpochRef = React.useRef<number>(-1);
    const leaseDebugCountersRef = React.useRef<PreviewLeaseDebugCounters>({
        lostLeaseUnmountCount: 0,
        reacquireAttemptCount: 0,
        reacquireSuccessCount: 0,
    });

    const logLeaseDebugCounters = React.useCallback(() => {
        if (!import.meta.env.DEV) return;
        const c = leaseDebugCountersRef.current;
        console.log(
            '[SampleGraphPreview][Lease] lostLeaseUnmountCount=%d reacquireAttemptCount=%d reacquireSuccessCount=%d',
            c.lostLeaseUnmountCount,
            c.reacquireAttemptCount,
            c.reacquireSuccessCount
        );
    }, []);
    React.useEffect(() => {
        let active = true;
        import('../samples/sampleGraphPreview.export.json')
            .then((mod) => {
                if (!active) return;
                setSampleExportPayload(mod.default);
            })
            .catch((error) => {
                if (!active) return;
                const reason = error instanceof Error ? error.message : 'unknown_sample_import_error';
                setSampleImportError(reason);
            });
        return () => {
            active = false;
        };
    }, []);

    const sampleLoadResult = React.useMemo<Result<SampleLoadSuccess>>(() => {
        if (sampleImportError) {
            return err(createValidationError('SAMPLE_IMPORT_FAILED', `sample import failed: ${sampleImportError}`));
        }
        if (sampleExportPayload === null) {
            return err(createValidationError('SAMPLE_LOADING', 'sample payload loading'));
        }
        const parsedDevResult = parseDevInterfaceExportStrict(sampleExportPayload);
        if (!parsedDevResult.ok) return parsedDevResult;
        const parsedDev = parsedDevResult.value;

        const adapted = (() => {
            try {
                return ok(devExportToSavedInterfaceRecordV1(parsedDev, { preview: true }));
            } catch (error) {
                const reason = error instanceof Error ? error.message : 'unknown_adapter_error';
                return err(createValidationError(
                    PREVIEW_VALIDATION_ERROR_CODE.ADAPTER_FAILED,
                    `dev export adapter failed: ${reason}`
                ));
            }
        })();

        return chainResult(adapted, (candidateRecord) => {
            const parsedPreviewRecord = parseSavedInterfaceRecordForPreview(candidateRecord);
            return chainResult(parsedPreviewRecord, (parsedRecord) =>
                chainResult(validateSampleGraphSemantic(parsedRecord), () => ok({ record: parsedRecord }))
            );
        });
    }, [sampleExportPayload, sampleImportError]);

    React.useLayoutEffect(() => {
        const result = acquireGraphRuntimeLease('prompt-preview', instanceIdRef.current);
        if (result.ok) {
            activeLeaseTokenRef.current = result.token;
            const nextState: LeaseState = { phase: 'allowed', token: result.token };
            leaseStateRef.current = nextState;
            setLeaseState(nextState);
            return;
        }
        const deniedState: LeaseState = {
            phase: 'denied',
            activeOwner: result.activeOwner,
            activeInstanceId: result.activeInstanceId,
        };
        leaseStateRef.current = deniedState;
        setLeaseState(deniedState);
        activeLeaseTokenRef.current = null;
        return;
    }, []);

    React.useEffect(() => {
        return () => {
            const token = activeLeaseTokenRef.current;
            if (token) {
                releaseGraphRuntimeLease(token);
                activeLeaseTokenRef.current = null;
            }
            warnIfGraphRuntimeResourcesUnbalanced('SampleGraphPreview.unmount');
        };
    }, []);

    React.useEffect(() => {
        return subscribeGraphRuntimeLease((snapshot) => {
            const token = activeLeaseTokenRef.current;
            if (token) {
                assertActiveLeaseOwner('prompt-preview', token);
                const isActive = isGraphRuntimeLeaseTokenActive(token);
                if (!isActive) {
                    leaseDebugCountersRef.current.lostLeaseUnmountCount += 1;
                    const pausedState: LeaseState = { phase: 'paused', reason: 'lost_lease' };
                    leaseStateRef.current = pausedState;
                    setLeaseState(pausedState);
                    activeLeaseTokenRef.current = null;
                    logLeaseDebugCounters();
                }
                return;
            }

            if (lastReacquireEpochRef.current === snapshot.epoch) return;
            if (snapshot.activeOwner === 'graph-screen') return;

            const currentPhase = leaseStateRef.current.phase;
            if (currentPhase !== 'paused' && currentPhase !== 'denied' && currentPhase !== 'checking') return;

            lastReacquireEpochRef.current = snapshot.epoch;
            leaseDebugCountersRef.current.reacquireAttemptCount += 1;
            const reacquireResult = acquireGraphRuntimeLease('prompt-preview', instanceIdRef.current);
            if (reacquireResult.ok) {
                leaseDebugCountersRef.current.reacquireSuccessCount += 1;
                activeLeaseTokenRef.current = reacquireResult.token;
                const allowedState: LeaseState = { phase: 'allowed', token: reacquireResult.token };
                leaseStateRef.current = allowedState;
                setLeaseState(allowedState);
                logLeaseDebugCounters();
                return;
            }
            const deniedState: LeaseState = {
                phase: 'denied',
                activeOwner: reacquireResult.activeOwner,
                activeInstanceId: reacquireResult.activeInstanceId,
            };
            leaseStateRef.current = deniedState;
            setLeaseState(deniedState);
            logLeaseDebugCounters();
        });
    }, [logLeaseDebugCounters]);

    React.useEffect(() => {
        if (!sampleExportPayload) return;
        warnIfInvalidCurrentSamplePreviewExportOnce(sampleExportPayload);
    }, [sampleExportPayload]);

    const isLeaseDenied = leaseState.phase === 'denied';
    const isLeasePaused = leaseState.phase === 'paused';
    const canMountRuntime = leaseState.phase === 'allowed' && portalRootEl && sampleLoadResult.ok;
    const sampleErrors: ValidationError[] = sampleLoadResult.ok ? [] : sampleLoadResult.errors;
    const isSampleLoading = sampleErrors.some((item) => item.code === 'SAMPLE_LOADING');
    const shownErrors = sampleErrors.slice(0, 3);
    const hiddenErrorCount = Math.max(sampleErrors.length - shownErrors.length, 0);

    React.useEffect(() => {
        if (!canMountRuntime) return;
        const rootEl = previewRootRef.current;
        if (!rootEl) return;

        const releaseWheelListener = trackResource('graph-runtime.preview.wheel-capture-listener');
        const onWheelCapture = (event: WheelEvent) => {
            if (isInsideSampleGraphPreviewOverlayInteractiveRoot(event.target)) {
                return;
            }
            event.preventDefault();
        };

        rootEl.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
        return () => {
            rootEl.removeEventListener('wheel', onWheelCapture, true);
            releaseWheelListener();
        };
    }, [canMountRuntime]);

    return (
        <div
            ref={previewRootRef}
            {...previewRootMarker}
            style={PREVIEW_ROOT_STYLE}
            onPointerDown={stopPropagation}
            onWheel={stopPropagation}
        >
            <div
                ref={setPortalRootEl}
                {...{ [SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR]: SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE }}
                style={PREVIEW_PORTAL_ROOT_STYLE}
            />
            <GraphViewportProvider value={boxedViewport}>
                <PreviewErrorBoundary>
                    <div style={PREVIEW_SURFACE_STYLE}>
                        {canMountRuntime ? (
                            <PortalScopeProvider mode="container" portalRootEl={portalRootEl}>
                                <TooltipProvider>
                                    <GraphPhysicsPlayground
                                        pendingAnalysisPayload={null}
                                        onPendingAnalysisConsumed={() => {}}
                                        pendingLoadInterface={sampleLoadResult.value.record}
                                        onPendingLoadInterfaceConsumed={() => {}}
                                        enableDebugSidebar={false}
                                    />
                                </TooltipProvider>
                            </PortalScopeProvider>
                        ) : isLeaseDenied ? (
                            <div style={PREVIEW_FALLBACK_STYLE}>
                                preview paused (active: {leaseState.activeOwner})
                            </div>
                        ) : isLeasePaused ? (
                            <div style={PREVIEW_FALLBACK_STYLE}>
                                preview paused (graph active elsewhere)
                            </div>
                        ) : isSampleLoading ? (
                            <div style={PREVIEW_FALLBACK_STYLE}>loading sample...</div>
                        ) : sampleErrors.length > 0 ? (
                            <div style={PREVIEW_ERROR_WRAP_STYLE}>
                                <div style={PREVIEW_ERROR_TITLE_STYLE}>sample graph invalid</div>
                                {shownErrors.map((error, idx) => (
                                    <div key={`${error.code}-${idx}`} style={PREVIEW_ERROR_LINE_STYLE}>
                                        [{error.code}] {error.message}
                                    </div>
                                ))}
                                {hiddenErrorCount > 0 ? (
                                    <div style={PREVIEW_ERROR_LINE_STYLE}>+{hiddenErrorCount} more</div>
                                ) : null}
                            </div>
                        ) : (
                            <div style={PREVIEW_FALLBACK_STYLE}>sample graph initializing...</div>
                        )}
                    </div>
                </PreviewErrorBoundary>
            </GraphViewportProvider>
        </div>
    );
};
