# Feedback Frontend API Helpers Step 6

Added in `src/api.ts`:

1. `submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult>`
2. `listFeedbackAdmin(input?: ListFeedbackAdminInput): Promise<ListFeedbackAdminResult>`
3. `updateFeedbackStatusAdmin(input: { id: number; status: FeedbackStatus }): Promise<{ ok: true; updated?: boolean }>`

Type exports added:
- `FeedbackStatus`
- `SubmitFeedbackInput`
- `SubmitFeedbackResult`
- `FeedbackAdminItem`
- `ListFeedbackAdminInput`
- `ListFeedbackAdminResult`

Auth transport note:
- These helpers rely on shared `apiGet` and `apiPost`.
- `apiGet`/`apiPost` use cookie credentials (`credentials: 'include'`), so no token storage is needed in frontend helpers.
