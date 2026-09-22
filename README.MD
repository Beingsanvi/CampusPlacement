# Campus Placement AI Agent

A multi-agent AI system for campus placement assistance using Microsoft Azure and Foundry.

## Features

- **Placement FAQ Agent**: Answers questions about eligibility, requirements, and processes
- **Preparation Agent**: Creates personalized preparation plans
- **RAG Integration**: Grounded answers from placement documents
- **GitHub Automation**: Automatic processing when documents are updated
- **Job Scraper**: Live job openings from Jobicy, Remotive, and Hacker News "Who is hiring?"
- **Job Matcher**: Scores openings against a student profile (resume upload or manual skills)
- **Cold Email Assistant**: Drafts personalized application emails, then **draft → approve → send** via SMTP (nothing sends without explicit approval)

## Architecture

```
Frontend (HTML/CSS/JS)
    ↓
Azure Function (Backend API)
    ↓
Microsoft Foundry
    ↓
Main Placement Agent
    ↓
├── FAQ Agent
└── Preparation Agent
    ↓
Azure AI Search (RAG)
    ↓
Placement Documents (GitHub)
```

## Project Structure

```
campus-placement-ai/
├── frontend/              # Separate frontend
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   └── js/
├── backend/               # Azure Functions backend
│   ├── function_app.py
│   ├── agents/
│   ├── services/
│   └── config/
├── documents/             # Placement documents
├── output/                # Processed output
└── .github/workflows/     # GitHub Actions
```

## Setup

### Prerequisites

- Azure account with Foundry project
- Microsoft Foundry model deployed
- Azure AI Search service (for RAG)
- Python 3.10+

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables (create `.env` file):
   ```
   FOUNDRY_PROJECT_ENDPOINT=your_foundry_endpoint
   MODEL_DEPLOYMENT_NAME=your_model_name
   AZURE_SEARCH_ENDPOINT=your_search_endpoint
   AZURE_SEARCH_API_KEY=your_search_key
   ```

4. Run locally:
   ```bash
   func start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Open `index.html` in a browser or use a local server:
   ```bash
   python -m http.server 8000
   ```

3. Update `API_BASE_URL` in `js/api.js` with your Azure Function URL

## API Endpoints

- `POST /api/chat` - Send a message to the AI agent (FAQ + Preparation agents)
- `GET /api/status` - Get system status
- `GET /api/activity` - Get recent activity
- `POST /api/upload` - Upload a document
- `GET /api/health` - Health check
- `GET` / `POST /api/profile` - Get / save your job profile
- `POST /api/profile/upload` - Parse a resume (PDF/DOCX/TXT) into a profile
- `GET /api/jobs` - Search live job openings (scraped)
- `POST /api/jobs/match` - Rank jobs against your profile
- `POST /api/email/draft` - Draft a personalized cold email (stored as pending)
- `GET /api/email/drafts` - List email drafts
- `POST /api/email/approve` - Approve a draft (optionally set recipient)
- `POST /api/email/send` - Send an **approved** draft via SMTP

## Sample Queries

- "What is the minimum CGPA required?"
- "Can students with active backlogs apply?"
- "Tell me about TechNova Solutions"
- "I have 30 days before placements. What should I prepare?"
- "What are the stages of the placement process?"

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FOUNDRY_PROJECT_ENDPOINT` | Microsoft Foundry project endpoint |
| `MODEL_DEPLOYMENT_NAME` | Deployed model name |
| `FOUNDRY_API_KEY` | Foundry API key |
| `AZURE_SEARCH_ENDPOINT` | Azure AI Search endpoint |
| `AZURE_SEARCH_API_KEY` | Azure AI Search API key |
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_REPO_OWNER` | GitHub repository owner |
| `GITHUB_REPO_NAME` | GitHub repository name |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server for sending cold emails |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP login (use an app password) |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender identity for cold emails |

> **Security:** keep all real keys only in `backend/.env` (gitignored). Never commit
> keys. Use `.env.example` as a template. Rotate any keys that were previously
> exposed (e.g. in early versions of `HANDOFF.md`).

## Job Search + Cold Email Flow

1. Save your profile (upload a resume **or** fill the form) on the **Jobs** page.
2. Click **Match Me** — openings are scraped live and scored against your profile.
3. Click **Draft email** on a match — the AI writes a personalized application email.
4. Review the draft, add a recipient email, then **Approve**.
5. Click **Send now** — only approved drafts are sent, via SMTP. Misfires are
   prevented by the approval gate.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License