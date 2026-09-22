# Campus Placement AI - Session Handoff

## Current Status

### What's Working
- ✅ Project structure created at `/Users/sanvi/CampusPlacement/`
- ✅ Backend agents (Main, FAQ, Preparation) implemented
- ✅ Frontend (HTML/CSS/JS) implemented
- ✅ Azure AI Search created: `campus-placement-search`
- ✅ Documents indexed in Azure AI Search (19 chunks)
- ✅ Azure Functions app created: `campus-placement-api-eah8hkg9embeh5e4`
- ✅ Foundry model working locally (verified live: chat, search, scoring, email draft)
- ✅ **v2.0 — Jobs & cold email (locally verified):**
  - Job scraper (Jobicy + Remotive + Hacker News "Who is hiring?"), disk-cached, sample-job fallback
  - Resume upload parser (PDF/DOCX/TXT) + manual profile editing
  - Job matcher scoring openings vs profile (0–100, explainable)
  - Cold-email agent: draft → approve → send (SMTP). Sending is gated on approval.
  - Chat now routes through the real Main/FAQ/Preparation agents
  - New endpoints: /profile, /profile/upload, /jobs, /jobs/match, /email/draft, /email/drafts, /email/approve, /email/send, /status, /activity
  - Secrets scrubbed from tracked files; .env.example added

### What Needs to Be Done
- Redeploy the backend (new endpoints) to Azure Functions
- Add SMTP app settings in Azure (or run locally) before real sending
- Connect the frontend to the deployed API (`frontend/js/api.js` -> `API_BASE_URL`)

### Fixed from earlier session
- Foundry endpoint + API key verified working exactly as coded (root cause of
  "placeholder responses" was env vars not set in the Function App)
- FAQ agent async/sync bug fixed (process() is synchronous; tests updated)
- Preparation agent response shape normalized into AgentResponse
- Frontend /status and /activity now exist; CORS added on all routes
- Profile/email drafts persist to backend/data/ (gitignored)

## Azure Resources

| Resource | Name/URL |
|----------|----------|
| Foundry Project | `https://projectsanvi.services.ai.azure.com/api/projects/proj-default` |
| Model | `gpt-4.1-mini` |
| Azure AI Search | `https://campus-placement-search.search.windows.net` |
| Function App | `https://campus-placement-api-eah8hkg9embeh5e4.koreacentral-01.azurewebsites.net` |
| Index | `placement-documents` |

## Credentials

> **SECURITY NOTE:** Real keys were previously kept in this file and in
> `backend/.env` / `backend/local.settings.json`. They have been scrubbed from
> tracked files and those files are now gitignored. **Rotate the old keys in
> Azure** (Foundry API key + Azure AI Search key) since they were exposed.

All real credentials live ONLY in `backend/.env` (gitignored). Copy
`.env.example` and fill it in. Required vars:

```
FOUNDRY_PROJECT_ENDPOINT=<foundry project endpoint>
MODEL_DEPLOYMENT_NAME=<deployed model>
FOUNDRY_API_KEY=<foundry key>
AZURE_SEARCH_ENDPOINT=<search endpoint>
AZURE_SEARCH_API_KEY=<search key>
AZURE_SEARCH_INDEX_NAME=placement-documents
# SMTP vars only needed for sending cold emails:
SMTP_HOST=...
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
EMAIL_FROM=...
EMAIL_FROM_NAME=...
```

## Deployment Issue (v1)

The function app had been deployed but the environment variables were not being
picked up, so the API returned placeholder responses. **Fixed insight:** the
Foundry endpoint/key combo works exactly as coded — the issue is simply that the
Function App settings were missing/incorrect. Use `deploy.sh` which now syncs app
settings from `backend/.env` and restarts the app after publishing.

## Next Steps

### Option 1: Get SCM Credentials
1. Go to Azure Portal → Function App → Settings → Configuration
2. Click **General settings** tab
3. Find **SCM Basic Auth** credentials
4. Use these to deploy via command line

### Option 2: Redeploy via Portal
1. Go to Deployment Center → Manual Deployment → Upload Zip
2. Upload `/Users/sanvi/CampusPlacement/backend/deploy.zip`
3. Wait for deployment to complete
4. Restart the Function App

### Option 3: Use deploy.sh (now syncs env vars)
1. Install Azure CLI: `brew install azure-cli`
2. Run: `./deploy.sh`
   - publishes to `campus-placement-api-eah8hkg9embeh5e4`
   - syncs FOUNDRY_*/AZURE_SEARCH_*/SMTP_* app settings from `backend/.env`
   - restarts the app

## Test Commands

```bash
# Test health
curl https://campus-placement-api-eah8hkg9embeh5e4.koreacentral-01.azurewebsites.net/api/health

# Test chat
curl -X POST https://campus-placement-api-eah8hkg9embeh5e4.koreacentral-01.azurewebsites.net/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the minimum CGPA required?"}'
```

## Project Structure

```
/Users/sanvi/CampusPlacement/
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   └── js/
├── backend/
│   ├── function_app.py
│   ├── agents/
│   ├── services/
│   └── requirements.txt
├── documents/
└── deploy.zip (on Desktop)
```

## Important Notes

1. The API works locally - all Azure services are connected
2. The issue is only with the deployed Function App not picking up environment variables
3. After fixing deployment, update the frontend's `api.js` to use the Function App URL
4. The search index is already created and populated in Azure AI Search
