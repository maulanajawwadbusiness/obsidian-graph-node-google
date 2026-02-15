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
    | { phase: 'denied'; activeOwner: GraphRuntimeOwner; activeInstanceId: string };

type SampleLoadSuccess = {
    record: SavedInterfaceRecordV1;
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
    const previewRootMarker: Record<string, string> = {
        [SAMPLE_GRAPH_PREVIEW_ROOT_ATTR]: SAMPLE_GRAPH_PREVIEW_ROOT_VALUE,
    };
    const [portalRootEl, setPortalRootEl] = React.useState<HTMLDivElement | null>(null);
    const [sampleExportPayload, setSampleExportPayload] = React.useState<unknown | null>(null);
    const [sampleImportError, setSampleImportError] = React.useState<string | null>(null);
    const instanceIdRef = React.useRef(
        `prompt-preview:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
    );
    const [leaseState, setLeaseState] = React.useState<LeaseState>({ phase: 'checking' });
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

    React.useEffect(() => {
        if (!sampleExportPayload) return;
        warnIfInvalidCurrentSamplePreviewExportOnce(sampleExportPayload);
    }, [sampleExportPayload]);

    const isLeaseDenied = leaseState.phase === 'denied';
    const canMountRuntime = leaseState.phase === 'allowed' && portalRootEl && sampleLoadResult.ok;
    const sampleErrors: ValidationError[] = sampleLoadResult.ok ? [] : sampleLoadResult.errors;
    const isSampleLoading = sampleErrors.some((item) => item.code === 'SAMPLE_LOADING');
    const shownErrors = sampleErrors.slice(0, 3);
    const hiddenErrorCount = Math.max(sampleErrors.length - shownErrors.length, 0);

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
        </div>
    );
};
