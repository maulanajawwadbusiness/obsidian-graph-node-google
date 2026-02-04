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
