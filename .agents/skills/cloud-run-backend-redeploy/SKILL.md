---
name: cloud-run-backend-redeploy
description: Reliable Cloud Run backend redeploy for arnvoid-api using one command with stable defaults, additive env and secret updates, and post-deploy readiness checks. Use this skill whenever Codex needs to redeploy backend code to Cloud Run after backend changes, update beta-mode backend toggles, or verify rollout health without retyping long gcloud commands.
---

# Cloud Run Backend Redeploy

Use the script in this skill to redeploy backend source to Cloud Run without manually retyping long commands.

## Workflow

1. Run preflight checks: `gcloud` installed and account available.
2. Deploy from source with stable defaults for arnvoid backend.
3. Use additive updates for env and secrets to avoid unintended deletion.
4. Verify rollout:
   - latest ready revision exists
   - traffic is 100% to latest ready revision
5. Return concise JSON summary.

## Command

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/cloud-run-backend-redeploy/scripts/deploy_backend.ps1" -Source "."
```

Optional toggle change:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/cloud-run-backend-redeploy/scripts/deploy_backend.ps1" -Source "." -BetaFreeMode "0"
```

## Rules

- Prefer `--update-env-vars` and `--update-secrets` for additive safety.
- Keep backend deploy first when toggling beta mode.
- Never print secret values.
- Use `-PrintOnly` to inspect generated command without execution.
- If gcloud flags drift, update `references/gcloud-run-deploy.md` and script together.

## Files

- `scripts/deploy_backend.ps1`: One-command deploy + rollout verification.
- `references/gcloud-run-deploy.md`: Flag mapping and safety notes.
