"""
Email agent - drafts personalized cold application emails using the LLM.

Workflow (safe by design):
  1. draft_application_email() -> creates a PENDING draft (nothing is sent)
  2. User reviews / edits the draft
  3. User approves it (endpoint requires an explicit approve call)
  4. send() sends only approved drafts over SMTP
"""

import json
import logging
import re
from typing import Any, Dict, Optional

from services import email_service
from services.foundry_service import get_foundry_client

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def query_llm_text(prompt: str, system_prompt: str = "You are a helpful assistant.", max_tokens: int = 1000) -> str:
    """Send a single-turn prompt to the Foundry model and return plain text."""
    client = get_foundry_client()
    response = client.chat_completion(
        messages=[{"role": "user", "content": prompt}],
        system_prompt=system_prompt,
        temperature=0.4,
        max_tokens=max_tokens,
    )
    return (response.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()


def _detect_contact_email(job: Dict[str, Any]) -> str:
    """Try to find a recruiter/company email in the job listing."""
    hay = " ".join([
        str(job.get("description", "")),
        str(job.get("apply_url", "")),
        str(job.get("url", "")),
    ])
    match = re.search(EMAIL_RE, hay)
    return match.group(0) if match else ""


def _fallback_draft(job: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, str]:
    """Template fallback used if the LLM is unreachable."""
    role = job.get("title", "the role")
    company = job.get("company", "your company")
    name = profile.get("name") or "candidate"
    skills = ", ".join((profile.get("skills") or [])[:6]) or "relevant skills"
    about = []
    if profile.get("education", {}).get("degree"):
        about.append(f"My {profile['education']['degree']}"
                     + (f" ({profile['education']['cgpa']} CGPA)" if profile['education'].get('cgpa') else ""))
    about.append(f"proficiency in {skills}")
    if profile.get("projects"):
        about.append(f"projects including {profile['projects'][0]}")
    body = (
        f"Subject: Application for {role} at {company}\n\n"
        f"Dear {company} hiring team,\n\n"
        f"My name is {name}. I'm excited to apply for the {role} position at {company}.\n\n"
        + " ".join(f"- I bring {a}." for a in about) +
        "\n\nI'm enthusiastic about contributing to your team and would welcome the "
        "opportunity to discuss how my background fits {company}.\n\n"
        "I've attached my resume for your review and would be glad to provide "
        "references or additional information.\n\nBest regards,\n{name}".format(company=company, name=name)
    )
    return {"subject": f"Application for {role} at {company}", "body": body}


def _llm_draft(job: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, str]:
    json_profile = json.dumps(profile, indent=2, default=str)[:3000]
    role = job.get("title", "")
    company = job.get("company", "")
    loc = job.get("location", "")

    prompt = (
        "Write a concise, professional cold job-application email. "
        "Return JSON only: {\"subject\": <string>, \"body\": <string>}. "
        "The body should be plain text, 120-160 words, no markdown, 3 short paragraphs "
        "(introduction, why you fit, call to action), signed with the candidate's name.\n\n"
        f"JOB:\nTitle: {role}\nCompany: {company}\nLocation: {loc}\n"
        f"Description: {job.get('description', '')[:1200]}\n\n"
        f"CANDIDATE PROFILE:\n{json_profile}"
    )
    raw = query_llm_text(prompt, system_prompt="You write effective, honest job application emails.", max_tokens=700)

    start = raw.find("{")
    end = raw.rfind("}")
    parsed: Dict[str, str] = {}
    if start != -1 and end != -1:
        try:
            parsed = json.loads(raw[start:end + 1])
        except Exception as e:
            logger.warning("LLM draft JSON parse failed: %s", e)
    if parsed.get("subject") and parsed.get("body"):
        return parsed
    return _fallback_draft(job, profile)


def draft_application_email(job: Dict[str, Any], profile: Dict[str, Any],
                            contact_email: str = "") -> Dict[str, Any]:
    """Create a pending draft for a job application email. Does NOT send."""
    try:
        rendered = _llm_draft(job, profile)
    except Exception as e:
        logger.warning("LLM draft fallback: %s", e)
        rendered = _fallback_draft(job, profile)

    detected = contact_email or _detect_contact_email(job)
    needs_contact = not detected

    return email_service.create_draft(
        job=job,
        subject=rendered["subject"],
        body=rendered["body"],
        profile=profile,
        contact_email=detected,
        needs_contact=needs_contact,
    )