"""
SMTP email service - sends cold application emails.

Sending is gated on approval: the email agent creates a draft, the user reviews
and approves it in the frontend, and only then is it sent. SMTP must be
configured via env vars (use an app password, not your account password).
"""

import logging
import smtplib
import time
import uuid
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Any, Dict, List, Optional

from config.settings import get_settings

logger = logging.getLogger(__name__)

DRAFTS_FILE = "drafts.json"


def _send(to_addr: str, subject: str, body: str, from_name: Optional[str] = None) -> Dict[str, Any]:
    cfg = get_settings().smtp
    if not cfg.is_configured:
        raise RuntimeError(
            "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, "
            "SMTP_PASSWORD and EMAIL_FROM in backend/.env"
        )

    from_email = cfg.email_from
    display_name = from_name or cfg.from_name or cfg.username

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = formataddr((display_name, from_email))
    msg["To"] = to_addr

    with smtplib.SMTP(cfg.host, cfg.port, timeout=30) as server:
        server.starttls()
        server.login(cfg.username, cfg.password)
        server.sendmail(from_email, [to_addr], msg.as_string())

    return {"to": to_addr, "subject": subject, "sent_at": time.time()}


def _load_drafts() -> List[Dict[str, Any]]:
    from services import storage

    drafts = storage.read_json(DRAFTS_FILE, default=[])
    return drafts if isinstance(drafts, list) else []


def _save_drafts(drafts: List[Dict[str, Any]]) -> None:
    from services import storage

    storage.write_json(DRAFTS_FILE, drafts)


def create_draft(job: Dict[str, Any], subject: str, body: str, profile: Dict[str, Any],
                 contact_email: str = "", needs_contact: bool = False) -> Dict[str, Any]:
    draft = {
        "draft_id": uuid.uuid4().hex[:12],
        "job": job,
        "profile_email": profile.get("email", ""),
        "contact_email": contact_email,
        "needs_contact": needs_contact,
        "subject": subject,
        "body": body,
        "status": "pending",
        "created_at": time.time(),
    }
    drafts = _load_drafts()
    drafts.append(draft)
    _save_drafts(drafts)
    return draft


def list_drafts(status: str = "") -> List[Dict[str, Any]]:
    drafts = _load_drafts()
    if status:
        drafts = [d for d in drafts if d.get("status") == status]
    return list(reversed(drafts))


def get_draft(draft_id: str) -> Optional[Dict[str, Any]]:
    for d in _load_drafts():
        if d.get("draft_id") == draft_id:
            return d
    return None


def update_draft(draft_id: str, **fields) -> Optional[Dict[str, Any]]:
    drafts = _load_drafts()
    for d in drafts:
        if d.get("draft_id") != draft_id:
            continue
        d.update(fields)
        _save_drafts(drafts)
        return d
    return None


def approve(draft_id: str, contact_email: str = "", edits: Optional[str] = None) -> Dict[str, Any]:
    draft = get_draft(draft_id)
    if not draft:
        raise KeyError(f"Draft not found: {draft_id}")
    if draft.get("status") == "sent":
        raise RuntimeError("This draft has already been sent")
    if contact_email:
        draft["contact_email"] = contact_email
        draft["needs_contact"] = False
    if edits:
        draft["body"] = edits
    draft["status"] = "approved"
    update_draft(draft_id, **{k: v for k, v in draft.items() if k != "draft_id"})
    return draft


def send_draft(draft_id: str) -> Dict[str, Any]:
    """Send an approved draft. Never sends before explicit approval."""
    draft = get_draft(draft_id)
    if not draft:
        raise KeyError(f"Draft not found: {draft_id}")

    if draft.get("status") != "approved":
        raise RuntimeError(
            "Draft must be approved first. Call /api/email/approve before sending."
        )
    if draft.get("needs_contact") or not draft.get("contact_email"):
        raise RuntimeError("A recipient email is required. Provide contact_email and approve again.")

    result = _send(draft["contact_email"], draft["subject"], draft["body"])
    draft["status"] = "sent"
    draft["sent_result"] = result
    update_draft(draft_id, **{k: v for k, v in draft.items() if k != "draft_id"})
    return result