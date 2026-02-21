# Cloud Run Backend Deploy Reference

This skill wraps Cloud Run deploy for backend source updates.

## Base Inputs

- Service: `arnvoid-api`
- Project: `arnvoid-project`
- Region: `asia-southeast2`
- Cloud SQL instance: `arnvoid-project:asia-southeast2:arnvoid-postgres`

## Safety Rules

- Use additive updates:
  - `--update-env-vars` instead of `--set-env-vars`
  - `--update-secrets` instead of `--set-secrets`
- Verify rollout after deploy:
  - `status.latestReadyRevisionName` exists
  - traffic to latest revision is 100%
- Keep required backend env keys present:
  - `INSTANCE_CONNECTION_NAME`
  - `DB_NAME`
  - `DB_USER`
  - `GOOGLE_CLIENT_ID`

## Equivalent Command Shape

```powershell
gcloud run deploy arnvoid-api `
  --project arnvoid-project `
  --source . `
  --region asia-southeast2 `
  --allow-unauthenticated `
  --add-cloudsql-instances arnvoid-project:asia-southeast2:arnvoid-postgres `
  --update-env-vars "INSTANCE_CONNECTION_NAME=arnvoid-project:asia-southeast2:arnvoid-postgres,DB_NAME=arnvoid,DB_USER=arnvoid_app,GOOGLE_CLIENT_ID=<client-id>,BETA_FREE_MODE=1" `
  --update-secrets "DB_PASSWORD=DB_PASSWORD:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest"
```

## Notes

- The script intentionally avoids printing secret values.
- Use script `-PrintOnly` to inspect generated command before running.
