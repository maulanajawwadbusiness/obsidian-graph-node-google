# Forensic Report: Chat & Doc Viewer Click Failure
**Date:** 2026-02-01
**Target:** `TextPreviewButton.tsx` and `FullChatToggle.tsx`.

## 1. Executive Summary
**Verdict**: **Confirmed Logic Flaw (Event Bubbling / Pointer Capture conflict)**.
**Severity**: **High** (Buttons unclickable).
**Status**: Root cause identified. Same mechanism as `CanvasOverlays` failure.

The "Pointer Capture Hardening" in `GraphPhysicsPlayground` captures the pointer on any `pointerdown` event that bubbles up. Neither `TextPreviewButton` nor `FullChatToggle` stops this propagation for Pointer events (only Mouse events in one case, and nothing in the other).

## 2. Forensic Analysis

### A. Component 1: `TextPreviewButton` (Doc Viewer)
*   **File**: `src/playground/components/TextPreviewButton.tsx`
*   **Flaw**: It stops `mousedown`, `mousemove`, `mouseup`, but **misses `pointerdown`**.
    ```typescript
    // TextPreviewButton.tsx:41
    onMouseDown={stopPropagation}
    onMouseMove={stopPropagation}
    onMouseUp={stopPropagation}
    // MISSING: onPointerDown={stopPropagation}
    ```
*   **Result**: `pointerdown` bubbles -> Parent Capture -> Click stolen.

### B. Component 2: `FullChatToggle` (Chatbar)
*   **File**: `src/fullchat/FullChatToggle.tsx`
*   **Flaw**: It has **zero** event propagation blocking. It relies entirely on `onClick`.
    ```typescript
    // FullChatToggle.tsx:46
    <button
        type="button"
        style={TOGGLE_STYLE}
        onClick={openFullChat}
        // MISSING: onMouseDown, onPointerDown, etc.
    >
    ```
*   **Result**: `pointerdown` bubbles -> Parent Capture -> Click stolen.

## 3. Recommended Fix
Apply the same `onPointerDown={stopPropagation}` fix to both components.

### 1. TextPreviewButton
Add `onPointerDown={stopPropagation}` to the button props.

### 2. FullChatToggle
Define a `stopPropagation` helper (or import if available, but defining locally is safer/faster) and add `onPointerDown={stopPropagation}` and `onMouseDown={stopPropagation}` (for consistency/legacy safety).
