import React from 'react';
import { useTooltipController } from './TooltipProvider';

type UseTooltipOptions = {
    disabled?: boolean;
    placement?: 'top';
    sourceId?: string;
};

type UseTooltipResult = {
    getAnchorProps: <T extends React.HTMLAttributes<HTMLElement>>(props?: T) => T;
};

function composeHandlers<E>(
    a?: (event: E) => void,
    b?: (event: E) => void
): (event: E) => void {
    return (event: E) => {
        a?.(event);
        b?.(event);
    };
}

export function useTooltip(content: string, options?: UseTooltipOptions): UseTooltipResult {
    const { showTooltip, hideTooltip } = useTooltipController();
    const trimmedContent = content.trim();
    const disabled = Boolean(options?.disabled) || trimmedContent.length === 0;
    const placement = options?.placement ?? 'top';
    const sourceId = options?.sourceId;

    const showFromTarget = React.useCallback((target: EventTarget | null) => {
        if (disabled) return;
        if (!(target instanceof Element)) return;
        showTooltip({
            content: trimmedContent,
            anchorEl: target,
            placement,
            sourceId,
        });
    }, [disabled, placement, showTooltip, sourceId, trimmedContent]);

    const handlePointerEnter = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
        showFromTarget(event.currentTarget);
    }, [showFromTarget]);

    const handlePointerLeave = React.useCallback(() => {
        hideTooltip();
    }, [hideTooltip]);

    const handleFocus = React.useCallback((event: React.FocusEvent<HTMLElement>) => {
        showFromTarget(event.currentTarget);
    }, [showFromTarget]);

    const handleBlur = React.useCallback(() => {
        hideTooltip();
    }, [hideTooltip]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            hideTooltip();
        }
    }, [hideTooltip]);

    const getAnchorProps = React.useCallback(<T extends React.HTMLAttributes<HTMLElement>>(props?: T): T => {
        const base = (props ?? {} as T);
        return {
            ...base,
            onPointerEnter: composeHandlers(base.onPointerEnter, handlePointerEnter),
            onPointerLeave: composeHandlers(base.onPointerLeave, handlePointerLeave),
            onFocus: composeHandlers(base.onFocus, handleFocus),
            onBlur: composeHandlers(base.onBlur, handleBlur),
            onKeyDown: composeHandlers(base.onKeyDown, handleKeyDown),
        } as T;
    }, [handleBlur, handleFocus, handleKeyDown, handlePointerEnter, handlePointerLeave]);

    return { getAnchorProps };
}

