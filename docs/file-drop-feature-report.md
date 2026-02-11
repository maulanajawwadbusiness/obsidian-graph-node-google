# File Drop Feature - Development Report

**Date:** 2026-02-09  
**Session Summary:** Implemented drag-and-drop file upload functionality for the EnterPrompt screen with visual feedback overlays.

---

## Features Implemented

### 1. File Drop with "Whisper Chip" Visual Feedback

**Files Modified:** `src/components/PromptCard.tsx`

When users drop files, they appear as minimalist "whisper chips" above the textarea input. Design follows the premium, flat, clean aesthetic matching Welcome1 screen.

**Chip Styling:**
- Transparent background with `rgba(255,255,255,0.08)` border
- 6px border-radius, compact padding
- File icon using `src/assets/file_mini_icon.png`
- Muted text color `rgba(255,255,255,0.55)`
- Dismiss × button on each chip

---

### 2. Screen-Level Drag and Drop

**Files Modified:** `src/screens/EnterPrompt.tsx`, `src/components/PromptCard.tsx`

Moved drag/drop handling from input field to entire EnterPrompt screen. Uses `dragEnter`/`dragLeave` counter pattern for reliable overlay state.

**State Management:**
- `attachedFiles: File[]` — stored in EnterPrompt, passed to PromptCard as props
- `isDragging: boolean` — controls drag overlay visibility
- `showUnsupportedError: boolean` — controls error overlay visibility

---

### 3. Drag Overlay

**Visual Feedback:** When dragging files over the screen, a 85% dim overlay appears with:
- Upload icon (`src/assets/upload_overlay_icon.png`) — 64px
- Header: "Add Document" (16px, bold)
- Description: "Drop document here to begin to analyze it" (13px, muted)

**Style Constants:**
- `DRAG_OVERLAY_STYLE` — fixed overlay, 85% black background
- `DRAG_OVERLAY_ICON_STYLE` — 64px icon
- `DRAG_OVERLAY_HEADER_STYLE`, `DRAG_OVERLAY_DESC_STYLE`

---

### 4. File Type Validation

**Supported Extensions:** `.pdf`, `.docx`, `.md`, `.txt`

```tsx
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'];

const isFileSupported = (file: File): boolean => {
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext ? ACCEPTED_EXTENSIONS.includes(ext) : false;
};
```

---

### 5. Error Overlay for Unsupported Files

When user drops an unsupported file type (e.g., .jpg, .png), an error overlay appears for 3 seconds:
- Error icon (`src/assets/error_icon.png`) — 32px (configurable via `ERROR_OVERLAY_ICON_SIZE`)
- Header: "Unsupported file format" (red tint)
- Description: "We only support PDF, DOCX, MD, and TXT files."

---

## Architecture Changes

### PromptCard Props Updated

```tsx
type PromptCardProps = {
    value?: string;
    onChange?: (text: string) => void;
    onSubmit?: (text: string) => void;
    disabled?: boolean;
    attachedFiles?: File[];      // NEW
    onRemoveFile?: (index: number) => void;  // NEW
};
```

PromptCard no longer manages attached files internally — it receives them as props from EnterPrompt.

---

## Tuning Knobs

For future adjustments, the following constants are available:

| Constant | File | Current Value | Purpose |
|----------|------|---------------|---------|
| `ERROR_OVERLAY_ICON_SIZE` | EnterPrompt.tsx | 32 | Error icon size (px) |
| `DRAG_OVERLAY_ICON_STYLE.width/height` | EnterPrompt.tsx | 64px | Upload icon size |
| `ACCEPTED_EXTENSIONS` | EnterPrompt.tsx | pdf,docx,md,txt | Allowed file types |

---

## Assets Used

- `src/assets/file_mini_icon.png` — File chip icon
- `src/assets/upload_overlay_icon.png` — Drag overlay icon
- `src/assets/error_icon.png` — Error overlay icon

---

## Testing Checklist

- [x] Drag file over screen → overlay appears
- [x] Drop supported file → chip appears in input area
- [x] Drop unsupported file → error overlay for 3 seconds
- [x] Click × on chip → file removed
- [x] Multiple files → multiple chips
- [x] Build passes with no TypeScript errors
