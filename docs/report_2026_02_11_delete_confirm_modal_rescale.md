# Report 2026-02-11: Delete Confirm Modal Restyle and 15 Percent Downscale

## Scope
Adjust the Sidebar delete confirmation modal visual style used from EnterPrompt flow:

1. Card background color must be `#0D1118`.
2. Card must have no border line.
3. Internal modal elements must be reduced by 15 percent.

File touched:
- `src/screens/AppShell.tsx`

## Root Context
The delete confirmation overlay is rendered by AppShell, not EnterPrompt, even when triggered from EnterPrompt screen via Sidebar.

Style seam:
- `DELETE_CONFIRM_CARD_STYLE`
- `DELETE_CONFIRM_TITLE_STYLE`
- `DELETE_CONFIRM_TEXT_STYLE`
- `DELETE_CONFIRM_BUTTON_ROW_STYLE`
- `DELETE_CONFIRM_CANCEL_STYLE`
- `DELETE_CONFIRM_PRIMARY_STYLE`

## Changes Applied

### 1) Card surface
- `background: '#0D1118'`
- `border: 'none'`

### 2) Internal size downscale (15 percent)
Applied 0.85 scaling to internal presentation values while keeping modal container footprint stable.

Updated values:
- Card radius: `14px -> 11.9px`
- Card padding: `18px 18px 16px -> 15.3px 15.3px 13.6px`
- Card gap: `10px -> 8.5px`
- Title font: `17px -> 14.5px`
- Body font: `14px -> 11.9px`
- Button row gap: `8px -> 6.8px`
- Button row top margin: `4px -> 3.4px`
- Button radius: `8px -> 6.8px`
- Button padding: `8px 14px -> 6.8px 11.9px`
- Button font: explicit `11.3px` for both buttons to avoid browser default oversizing.

Unchanged by design:
- Container width and max-width (`420px`) to keep overlay footprint stable.
- Backdrop behavior and pointer shielding.
- Delete/Cancel interaction logic.

## Manual Verification Checklist
1. Open EnterPrompt screen and trigger Sidebar delete on any saved interface.
2. Confirm modal card color is `#0D1118`.
3. Confirm modal card has no visible border line.
4. Confirm title, text, buttons, spacing, and padding are visibly smaller by about 15 percent.
5. Confirm `Cancel` closes modal and `Delete` still deletes.

