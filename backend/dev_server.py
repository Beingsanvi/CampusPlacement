"""
Local development server for the Campus Placement AI backend.

Run (from project root):
    .venv/bin/python backend/dev_server.py

Serves the same /api/* routes as function_app.py using the standard library,
so you can demo locally without Azure Functions Core Tools. For production,
deploy function_app.py to Azure Functions and point the frontend at it.
"""

import json
import logging
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from services import profile_service, storage
from services import email_service
from services.job_scraper_service import Job, search_jobs
from services.foundry_service import get_foundry_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PORT = int(os.getenv("DEV_SERVER_PORT", "8001"))


def json_response(handler, data, status=200):
    body = json.dumps(data, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", 0))
    except (TypeError, ValueError):
        length = 0
    if not length:
        return {}
    try:
        return json.loads(handler.rfile.read(length).decode("utf-8") or "{}")
    except Exception:
        return {}


def parse_multipart(handler):
    """Parse multipart/form-data into {fields, files:[{name, filename, data}]}."""
    content_type = handler.headers.get("Content-Type", "")
    m = re.search(r"boundary=([^;]+)", content_type)
    if not m:
        return {"fields": {}, "files": []}
    boundary = m.group(1).encode("utf-8")
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length)
    delimiter = b"--" + boundary
    fields = {}
    files = []
    for part in raw.split(delimiter):
        if not part or part in (b"--\r\n", b"\r\n"):
            continue
        body = None
        headers, _, body = part.partition(b"\r\n\r\n")
        if body.endswith(b"\r\n"):
            body = body[:-2]
        head = headers.decode("utf-8", "replace")
        disposition = ""
        name = ""
        filename = ""
        for line in head.split("\r\n"):
            if line.lower().startswith("content-disposition"):
                disposition = line
        name_m = re.search(r'name="([^"]*)"', disposition)
        if name_m:
            name = name_m.group(1)
        file_m = re.search(r'filename="([^"]*)"', disposition)
        if file_m:
            filename = file_m.group(1)
        if filename:
            files.append({"name": name, "filename": filename, "data": body})
        else:
            fields[name] = body.decode("utf-8", "replace") if body else ""
    return {"fields": fields, "files": files}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logger.info("%s - %s", self.address_string(), fmt % args)

    def _options(self):
        json_response(self, {"cors": True})

    def do_OPTIONS(self):
        self._options()

    def do_GET(self):
        return self._dispatch()

    def do_POST(self):
        return self._dispatch()

    def _dispatch(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)
        q = lambda k, d="": query.get(k, [d])[0]  # noqa: E731

        self.path_qs = q
        self.query = query

        if path == "/api/health":
            return json_response(self, {"status": "healthy"})

        if path == "/api/status":
            from agents.main_agent import create_main_agent
            from config.settings import get_settings

            agent = create_main_agent()
            base = agent.get_system_status()
            base.update({
                "foundry_configured": get_foundry_client().is_configured(),
                "search_key_set": bool(os.environ.get("AZURE_SEARCH_API_KEY")),
                "profile": bool(profile_service.get_profile()),
                "smtp_configured": get_settings().smtp.is_configured,
            })
            return json_response(self, base)

        if path == "/api/debug":
            return json_response(self, {
                "foundry_base_url": get_foundry_client().base_url,
                "foundry_key_set": bool(os.environ.get("FOUNDRY_API_KEY")),
                "search_key_set": bool(os.environ.get("AZURE_SEARCH_API_KEY")),
                "model_name": os.environ.get("MODEL_DEPLOYMENT_NAME", "NOT SET"),
                "smtp_configured": bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_PASSWORD")),
            })

        if path == "/api/activity":
            return json_response(self, {"activities": storage.read_json("activity.json", default=[])})

        if path == "/api/chat" and self.command == "POST":
            body = read_json_body(self)
            message = (body.get("message") or "").strip()
            if not message:
                return json_response(self, {"error": "No message provided"}, 400)
            from agents.main_agent import create_main_agent

            response = create_main_agent().process_query(message)
            storage.record_activity(f"Chat answered ({response.query_type})")
            return json_response(self, {
                "answer": response.answer,
                "sources": response.sources,
                "query_type": response.query_type,
                "agent_used": response.agent_used,
                "confidence": response.confidence,
            })

        if path == "/api/profile":
            if self.command == "GET":
                return json_response(self, {"profile": profile_service.get_profile()})
            return json_response(self, {"profile": profile_service.save_profile(read_json_body(self))})

        if path == "/api/profile/upload" and self.command == "POST":
            parsed_body = parse_multipart(self)
            files = parsed_body["files"]
            if not files:
                return json_response(self, {"error": "No file provided. Field name: resume"}, 400)
            file = files[0]
            use_llm = q("enrich", "true").lower() != "false"
            parsed = profile_service.parse_resume_file(file["data"], file["filename"], use_llm=use_llm)
            saved = profile_service.save_profile(parsed)
            return json_response(self, {"profile": saved, "parsed_from": file["filename"]})

        if path == "/api/jobs":
            import services.job_scraper_service as scraper

            if q("refresh", "").lower() in ("1", "true", "yes"):
                scraper.get_jobs(force_refresh=True)
            limit = int(q("limit", "20") or "20")
            results = search_jobs(q=q("q"), location=q("location"),
                                  remote_only=q("remote", "").lower() in ("1", "true", "yes"), limit=limit)
            storage.record_activity(f"Job search: {len(results)} results")
            return json_response(self, {"jobs": [j.to_dict() for j in results]})

        if path == "/api/jobs/match":
            from agents.job_match_agent import match_jobs

            body = read_json_body(self) if self.command == "POST" else {}
            prof = body.get("profile") or profile_service.get_profile()
            if not prof:
                return json_response(self, {"error": "No profile found. Upload a resume or save a profile first."}, 400)

            job_dicts = body.get("jobs")
            live_jobs = []
            if job_dicts:
                for j in job_dicts:
                    try:
                        live_jobs.append(Job(**j))
                    except (TypeError, ValueError):
                        continue
            else:
                live_jobs = search_jobs(q=body.get("q", ""), location=body.get("location", ""),
                                        remote_only=bool(body.get("remote")), limit=40)
            ranked = match_jobs(prof, live_jobs, limit=int(body.get("limit", 15)))
            return json_response(self, {"matches": ranked, "count": len(ranked)})

        if path == "/api/email/draft" and self.command == "POST":
            from agents.email_agent import draft_application_email

            body = read_json_body(self)
            job = body.get("job")
            if not job or not job.get("title"):
                return json_response(self, {"error": "A job object is required (title, company, ...)"}, 400)
            prof = body.get("profile") or profile_service.get_profile()
            if not prof:
                return json_response(self, {"error": "No profile found. Upload a resume or save a profile first."}, 400)
            draft = draft_application_email(job, prof, contact_email=body.get("contact_email", ""))
            return json_response(self, {"draft": draft, "message": "Draft created. Review it, then approve before sending."})

        if path == "/api/email/drafts":
            return json_response(self, {"drafts": email_service.list_drafts(status=q("status"))})

        if path == "/api/email/approve" and self.command == "POST":
            body = read_json_body(self)
            draft_id = body.get("draft_id", "")
            if not draft_id:
                return json_response(self, {"error": "draft_id is required"}, 400)
            try:
                draft = email_service.approve(draft_id, contact_email=body.get("contact_email", ""), edits=body.get("edits"))
            except KeyError as e:
                return json_response(self, {"error": str(e)}, 404)
            return json_response(self, {"draft": draft, "message": "Approved. Call /api/email/send to actually send."})

        if path == "/api/email/send" and self.command == "POST":
            body = read_json_body(self)
            draft_id = body.get("draft_id", "")
            if not draft_id:
                return json_response(self, {"error": "draft_id is required"}, 400)
            try:
                result = email_service.send_draft(draft_id)
            except KeyError as e:
                return json_response(self, {"error": str(e)}, 404)
            except Exception as e:
                return json_response(self, {"error": str(e)}, 400)
            storage.record_activity(f"Email sent ({result.get('to')})")
            return json_response(self, {"result": result, "message": "Email sent."})

        if path == "/api/upload" and self.command == "POST":
            parsed_body = parse_multipart(self)
            saved = []
            for file in parsed_body["files"]:
                path_out = os.path.join(storage.get_data_dir(), "uploads", file["filename"])
                os.makedirs(os.path.dirname(path_out), exist_ok=True)
                with open(path_out, "wb") as f:
                    f.write(file["data"])
                saved.append(path_out)
            return json_response(self, {"uploaded": saved})

        return json_response(self, {"error": f"Not found: {self.command} {path}"}, 404)


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"\n  Campus Placement AI backend running → http://localhost:{PORT}/api\n")
    print("  Endpoints: /api/health  /api/status  /api/chat  /api/profile")
    print("             /api/profile/upload  /api/jobs  /api/jobs/match")
    print("             /api/email/draft  /api/email/drafts  /api/email/approve  /api/email/send\n")
    server.serve_forever()


if __name__ == "__main__":
    main()