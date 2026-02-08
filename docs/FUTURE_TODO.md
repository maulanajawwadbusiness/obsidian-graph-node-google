## Future TODOs

1. Refer to `docs/todo_flat_blue_fix_8_runs.md` as the very first task to pick up.
2. Add a `"how to think" brain` system prompt / string system that reads the topology API so the AI can wire in sharp result understanding.
3. Implement a 10% expand-at-launch behavior: the map should start with 10% extra energy so it feels alive instead of static.
4. Hide the full chat bar window (leave the floating icon on the bottom-right intact for future activation).
5. Remove the handoff button from the mini chat bar since the full chat bar is hidden.
6. Hide the `Debug`, `Theme:`, and `Controls` debug buttons that appear at the top (they should only be visible behind flags).
7. Surface the document viewer search UI so users can launch the search feature already wired under the hood.
8. Improve node hover highlight rendering: fix color jumps, overly dark fades, and invisible edges so highlights remain sharp.
9. Add a `• • •` menu button plus a share button on the top-right; move the document viewer button next to the share control.
10. Build a collapsible left sidebar with a title bar, name, and account controls.
11. Wire `LLMClient` to actually support both OpenAI and OpenRouter paths (OpenRouter currently not callable).
12. Track LLM token consumption, convert it to cost, and deduct from user credit.
13. Track user credit balance and expose the ability to add/remove credit (admin tools or UI controls).
14. Integrate Midtrans (production & sandbox keys ready), show a QR code on the front, and add a signal detector for payment success.
15. Connect native authentication to user accounts so payments link to the right profile.
16. Hook user data storage to Google Cloud SQL (PostgreSQL) for both profile and map/history data.
17. Create a homepage/welcome state with dedicated screens to sell the experience.
18. Let users request a new analysis via a centered chat screen; after each request, store the analysis result and generated map.
19. Add a share flow that saves map state and history so users can share their work later.
20. Prioritize a visceral, nerve-and-bone user experience—if the user doesn’t feel it, it’s not done.
21. Wire the pricing model into the product and tie it directly to user accounts for gating access.

## Welcome2 Typing Visual Stability (Chars Phase In/Out)

1. Verify text shaping lock in `Welcome2` is always active (`fontKerning`, ligatures, and feature flags) and cannot be accidentally removed by future style merges.
2. Ensure global `text-rendering: optimizeLegibility` does not override local `Welcome2` intent on any browser engine (Chromium, Firefox, Safari).
3. Prevent font fallback swaps during typing (FOIT/FOUT): confirm `Quicksand` is loaded before typing starts or lock to a stable fallback for onboarding.
4. Check variable font axis drift and font-weight mismatch across root and screen styles; ensure stable weight/metrics during character append.
5. Confirm cursor box does not push line wrapping at edge cases (end-of-line, near max width, narrow viewport); keep cursor layout impact minimal.
6. Validate no cursor remount/reflow on phase changes (`typing`, `pause`, `hold`, `done`) that can visually perturb adjacent glyphs.
7. Audit line-height and baseline alignment so newline transitions do not create vertical glyph jitter between lines.
8. Guard against subpixel rounding drift from container width/padding changes while typing (responsive breakpoints, dynamic scrollbars, window resize).
9. Re-test with DPR changes and zoom levels (100%, 125%, 150%, 175%) to catch anti-alias shimmer and glyph edge crawling.
10. Ensure no CSS transforms, opacity stacking, or compositing changes are applied to the text container during typing.
11. Confirm semantic cadence pauses do not produce bursty catch-up frames that appear as visual flicker after background tab return.
12. Verify `visibleCharCount` never regresses and never skips in a way that creates perceived overlap at punctuation/newline boundaries.
13. Validate newline and paragraph timing around `\n` and `\n\n` does not create double-paint artifacts at the exact drop frame.
14. Re-check ligature-only mode fallback (if re-enabled) to ensure no cross-character re-shape appears as slip/blip.
15. Confirm `whiteSpace: pre-wrap` plus long words does not trigger oscillating wrap positions when semantic pauses are heavy.
16. Ensure no focus style, selection style, or pointer highlight leaks onto the text container while typing.
17. Validate browser-specific anti-alias behavior in dark theme (text color contrast and gamma) to reduce "phase out" perception.
18. Add a minimal visual-stability debug mode to log font family in use, computed text rendering props, and first wrap boundary index for reproducible bug reports.
19. Capture a reproducible matrix: browser, OS, GPU acceleration on/off, DPR, zoom, and font availability for each reported jarring case.
20. Define acceptance criteria for "solid text": no perceived character slip, no overlap illusion, no wrap jitter, and stable readability during full manifesto playback.
21. Replace the failed blank-screen preload gate experiment in Welcome1 with a true mount-stability gate. The previous attempt showed text slipping in front of the blank surface and continuous layout changes. Future fix must guarantee no partial text paint before reveal, no live reflow during reveal, and no visual jump at first frame.
