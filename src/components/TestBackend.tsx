import React, { useState } from 'react';
import { apiGet, ApiGetResult } from '../api';

const PANEL_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'monospace',
    pointerEvents: 'auto',
    zIndex: 1000
};

export default function TestBackend() {
    const [result, setResult] = useState<ApiGetResult | null>(null);
    const [errorText, setErrorText] = useState<string>('not tested yet');

    async function test() {
        try {
            setErrorText('');
            const data = await apiGet('/health');
            setResult(data);
        } catch (e: any) {
            setResult(null);
            setErrorText(String(e));
        }
    }

    return (
        <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
            <button
                onClick={test}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                }}
            >
                test backend
            </button>
            {result && (
                <pre style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap' }}>
                    url: {result.url}
                    {'\n'}status: {result.status}
                    {'\n'}content-type: {result.contentType || 'unknown'}
                    {'\n'}ok: {String(result.ok)}
                    {'\n'}error: {result.error || 'none'}
                    {'\n'}json: {result.data ? JSON.stringify(result.data) : 'null'}
                    {'\n'}text: {result.text.slice(0, 200)}
                </pre>
            )}
            {!result && (
                <pre style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap' }}>
                    {errorText}
                </pre>
            )}
        </div>
    );
}
