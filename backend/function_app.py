"""
Azure Function App for Campus Placement AI Agent.

Endpoints (all under /api):
  GET  /health                               health check
  GET  /debug                                env config debug (no secrets)
  GET  /status                               system status (agents + services)
  GET  /activity                             recent activity log
  POST /chat                                 chat with the placement agents
  GET  /profile                              get saved profile
  POST /profile                              save profile (JSON)
  POST /profile/upload                       parse a resume upload (multipart)
  GET  /jobs                                 search job openings (scraped)
  POST /jobs/match                           rank jobs against a profile
  POST /email/draft                          draft a cold application email
  GET  /email/drafts                         list drafts (?status=pending/approved/sent)
  POST /email/approve                        approve a draft (adds contact/edits)
  POST /email/send                           send an APPROVED draft via SMTP
  POST /upload                               legacy file upload (stores file only)
"""

import json
import logging
import os

import azure.functions as func

from services import profile_service, storage
from services import email_service
from services.job_scraper_service import Job, search_jobs
from services.foundry_service import get_foundry_client
from services.search_service import get_search_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = func.FunctionApp()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json(body, status_code=200, cors=True) -> func.HttpResponse:
    headers = {"Content-Type": "application/json"}
    if cors:
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
    return func.HttpResponse(
        body=json.dumps(body, default=str),
        status_code=status_code,
        headers=headers,
        mimetype="application/json",
    )


def _parse_json(req: func.HttpRequest) -> dict:
    try:
        body = req.get_json()
        return body if isinstance(body, dict) else {}
    except Exception:
        return {}


def _preflight(req: func.HttpRequest):
    if req.method == "OPTIONS":
        return _json({"cors": True})


# ---------------------------------------------------------------------------
# Chat / status
# ---------------------------------------------------------------------------

@app.route(route="chat", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def chat(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    logging.info("Chat request received.")
    try:
        body = _parse_json(req)
    except ValueError:
        return _json({"error": "Invalid JSON"}, 400, cors=True)

    message = (body.get("message") or "").strip()
    if not message:
        return _json({"error": "No message provided"}, 400)

    from agents.main_agent import create_main_agent

    try:
        agent = create_main_agent()
        response = agent.process_query(message)
        result = {
            "answer": response.answer,
            "sources": response.sources,
            "query_type": response.query_type,
            "agent_used": response.agent_used,
            "confidence": response.confidence,
        }
        storage.record_activity(f"Chat answered ({response.query_type})")
        return _json(result)
    except Exception as e:
        logging.exception("Chat processing failed")
        return _json({"error": f"Failed to process query: {e}"}, 500)


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"status": "healthy"})


@app.route(route="debug", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def debug(req: func.HttpRequest) -> func.HttpResponse:
    return _json({
        "search_endpoint_set": bool(os.environ.get("AZURE_SEARCH_ENDPOINT")),
        "search_key_set": bool(os.environ.get("AZURE_SEARCH_API_KEY")),
        "foundry_base_url": get_foundry_client().base_url,
        "foundry_key_set": bool(os.environ.get("FOUNDRY_API_KEY")),
        "model_name": os.environ.get("MODEL_DEPLOYMENT_NAME", "NOT SET"),
        "smtp_configured": bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_PASSWORD")),
    })


@app.route(route="status", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def status(req: func.HttpRequest) -> func.HttpResponse:
    from agents.main_agent import create_main_agent

    agent = create_main_agent()
    base = agent.get_system_status()
    from config.settings import get_settings

    base.update({
        "foundry_configured": get_foundry_client().is_configured(),
        "search_key_set": bool(os.environ.get("AZURE_SEARCH_API_KEY")),
        "profile": bool(profile_service.get_profile()),
        "smtp_configured": get_settings().smtp.is_configured,
    })
    return _json(base)


@app.route(route="activity", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def activity(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"activities": storage.read_json("activity.json", default=[])})


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@app.route(route="profile", methods=["GET", "POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def profile(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    if req.method == "GET":
        return _json({"profile": profile_service.get_profile()} or {"profile": None})
    try:
        body = _parse_json(req)
        saved = profile_service.save_profile(body)
        return _json({"profile": saved})
    except Exception as e:
        logging.exception("Profile save failed")
        return _json({"error": str(e)}, 400)


@app.route(route="profile/upload", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def profile_upload(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        file = req.files.get("resume")
        if not file:
            files = list(req.files.values())
            file = files[0] if files else None
        if not file:
            return _json({"error": "No file provided. Field name: resume"}, 400)
        data = file.stream.read()
        filename = str(file.filename or "resume.pdf")
        use_llm = req.params.get("enrich", "true").lower() != "false"
        parsed = profile_service.parse_resume_file(data, filename, use_llm=use_llm)
        saved = profile_service.save_profile(parsed)
        return _json({"profile": saved, "parsed_from": filename})
    except Exception as e:
        logging.exception("Resume upload failed")
        return _json({"error": f"Could not parse resume: {e}"}, 400)


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@app.route(route="jobs", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def jobs(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        q = req.params.get("q", "")
        location = req.params.get("location", "")
        remote = req.params.get("remote", "").lower() in ("1", "true", "yes")
        limit = int(req.params.get("limit", "20"))
        refresh = req.params.get("refresh", "").lower() in ("1", "true", "yes")

        import services.job_scraper_service as scraper
        if refresh:
            scraper.get_jobs(force_refresh=True)

        results = search_jobs(q=q, location=location, remote_only=remote, limit=limit)
        storage.record_activity(f"Job search: {len(results)} results")
        return _json({
            "jobs": [j.to_dict() for j in results],
            "query": {"q": q, "location": location, "remote": remote, "limit": limit},
        })
    except Exception as e:
        logging.exception("Jobs endpoint failed")
        return _json({"error": str(e)}, 500)


@app.route(route="jobs/match", methods=["POST", "GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def jobs_match(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        from agents.job_match_agent import match_jobs
        from services.job_scraper_service import Job

        body = _parse_json(req) if req.method == "POST" else {}
        prof = body.get("profile") or profile_service.get_profile()
        if not prof:
            return _json({"error": "No profile found. Upload a resume or save a profile first."}, 400)

        job_dicts = body.get("jobs")
        live_jobs = []
        if job_dicts:
            for j in job_dicts:
                try:
                    live_jobs.append(Job(**j))
                except (TypeError, ValueError) as e:
                    logger.warning("Invalid job in match request: %s", e)
        else:
            live_jobs = search_jobs(
                q=body.get("q", ""),
                location=body.get("location", ""),
                remote_only=bool(body.get("remote")),
                limit=40,
            )

        ranked = match_jobs(prof, live_jobs, limit=int(body.get("limit", 15)))
        storage.record_activity("Profile matched against jobs")
        return _json({"matches": ranked, "count": len(ranked)})
    except Exception as e:
        logging.exception("Match endpoint failed")
        return _json({"error": str(e)}, 500)


# ---------------------------------------------------------------------------
# Email (draft -> approve -> send)
# ---------------------------------------------------------------------------

@app.route(route="email/draft", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def email_draft(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        body = _parse_json(req)
        job = body.get("job")
        if not job or not job.get("title"):
            return _json({"error": "A job object is required (title, company, ...)"}, 400)
        prof = body.get("profile") or profile_service.get_profile()
        if not prof:
            return _json({"error": "No profile found. Upload a resume or save a profile first."}, 400)

        from agents.email_agent import draft_application_email

        draft = draft_application_email(job, prof, contact_email=body.get("contact_email", ""))
        storage.record_activity(f"Email drafted for {job.get('title')}")
        return _json({"draft": draft, "message": "Draft created. Review it, then approve before sending."})
    except Exception as e:
        logging.exception("Email draft failed")
        return _json({"error": str(e)}, 500)


@app.route(route="email/drafts", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def email_drafts(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    status = req.params.get("status", "")
    return _json({"drafts": email_service.list_drafts(status=status)})


@app.route(route="email/approve", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def email_approve(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        body = _parse_json(req)
        draft_id = body.get("draft_id", "")
        if not draft_id:
            return _json({"error": "draft_id is required"}, 400)
        draft = email_service.approve(
            draft_id,
            contact_email=body.get("contact_email", ""),
            edits=body.get("edits"),
        )
        return _json({"draft": draft, "message": "Approved. Call /api/email/send to actually send."})
    except KeyError as e:
        return _json({"error": str(e)}, 404)
    except Exception as e:
        logging.exception("Approve failed")
        return _json({"error": str(e)}, 400)


@app.route(route="email/send", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def email_send(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        body = _parse_json(req)
        draft_id = body.get("draft_id", "")
        if not draft_id:
            return _json({"error": "draft_id is required"}, 400)
        result = email_service.send_draft(draft_id)
        storage.record_activity(f"Email sent ({result.get('to')})")
        return _json({"result": result, "message": "Email sent."})
    except KeyError as e:
        return _json({"error": str(e)}, 404)
    except Exception as e:
        logging.exception("Email send failed")
        return _json({"error": str(e)}, 400)


# ---------------------------------------------------------------------------
# Legacy / misc
# ---------------------------------------------------------------------------

@app.route(route="upload", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def upload(req: func.HttpRequest) -> func.HttpResponse:
    pre = _preflight(req)
    if pre:
        return pre
    try:
        files = req.files
        if not files:
            return _json({"error": "No files provided"}, 400)
        saved = []
        for name, file in files.items():
            path = os.path.join(storage.get_data_dir(), "uploads", str(file.filename or name))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(file.stream.read())
            saved.append(path)
        storage.record_activity(f"Uploaded {len(saved)} file(s)")
        return _json({"uploaded": saved})
    except Exception as e:
        logging.exception("Upload failed")
        return _json({"error": str(e)}, 400)