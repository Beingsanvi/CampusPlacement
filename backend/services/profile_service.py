"""
Profile service - store, validate, and auto-extract a student job profile.

Profiles can be provided in 3 ways:
1. Manual: POST /api/profile with structured JSON
2. Uploaded resume: POST /api/profile/upload (parsed heuristically + optionally
   enriched by the LLM with existing skills/experience)
3. Edited manually in the frontend after extraction
"""

import logging
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

from config.settings import get_settings
from services import storage

logger = logging.getLogger(__name__)

PROFILE_FILE = "profile.json"

# Common skills token list used for heuristic extraction from resume text.
SKILL_TOKENS = [
    "python", "java", "c++", "c#", "c", "javascript", "typescript", "go",
    "rust", "kotlin", "swift", "ruby", "php", "html", "css", "react",
    "react native", "angular", "vue", "node.js", "nodejs", "django", "flask",
    "fastapi", "spring boot", "spring", "express", "sql", "mysql", "postgresql",
    "postgres", "mongodb", "redis", "sqlite", "oracle", "aws", "azure",
    "google cloud", "gcp", "docker", "kubernetes", "terraform", "linux",
    "git", "github", "gitlab", "jenkins", "pandas", "numpy", "matplotlib",
    "scikit-learn", "scikit learn", "tensorflow", "keras", "pytorch",
    "opencv", "nlp", "llm", "machine learning", "deep learning", "data science",
    "data analysis", "data visualization", "tableau", "power bi", "spark",
    "hadoop", "flink", "statistics", "probability", "linear algebra",
    "excel", "powerpoint", "word", "selenium", "pytest", "unittest",
    "junit", "ci/cd", "rest api", "graphql", "oauth", "jwt", "microservices",
    "system design", "data structures", "algorithms", "os", "dbms",
    "computer networks", "oop", "design patterns", "agile", "scrum",
]


def default_profile() -> Dict[str, Any]:
    return {
        "name": "",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "github": "",
        "portfolio": "",
        "education": {"degree": "", "institution": "", "year": "", "cgpa": ""},
        "skills": [],
        "experience": [],
        "projects": [],
        "certifications": [],
        "role_preference": "",
        "job_type": "",  # remote / onsite / hybrid
        "years_experience": 0,
        "summary": "",
    }


def get_profile() -> Optional[Dict[str, Any]]:
    profile = storage.read_json(PROFILE_FILE, default=None)
    if not profile:
        return None
    merged = default_profile()
    merged.update(profile)
    if not isinstance(merged.get("skills"), list):
        merged["skills"] = [s for s in str(merged.get("skills", "")).split(",") if s.strip()]
    return merged


def save_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and persist a profile. Missing keys are filled with defaults."""
    cleaned = default_profile()
    if not isinstance(profile, dict):
        raise ValueError("Profile must be a JSON object")

    if "skills" in profile:
        skills = profile["skills"]
        if isinstance(skills, str):
            skills = [s.strip() for s in re.split(r"[,\n]", skills) if s.strip()]
        cleaned["skills"] = sorted(set(str(s).strip() for s in skills if str(s).strip()))

    string_fields = [
        "name", "email", "phone", "location", "linkedin", "github", "portfolio",
        "role_preference", "job_type", "summary"
    ]
    for field in string_fields:
        value = profile.get(field, cleaned.get(field, ""))
        cleaned[field] = str(value) if value else ""

    edu = profile.get("education") or {}
    if isinstance(edu, dict):
        for k in ("degree", "institution", "year", "cgpa"):
            cleaned["education"][k] = str(edu.get(k, "") or "")

    for key in ("experience", "projects", "certifications"):
        value = profile.get(key, [])
        cleaned[key] = [
            v for v in (value if isinstance(value, list) else []) if isinstance(v, dict)
        ] if key == "experience" else [str(v).strip() for v in (value if isinstance(value, list) else []) if str(v).strip()]

    try:
        cleaned["years_experience"] = float(profile.get("years_experience", 0) or 0)
    except (TypeError, ValueError):
        cleaned["years_experience"] = 0

    storage.write_json(PROFILE_FILE, cleaned)
    storage.record_activity("Profile updated")
    return cleaned


# ---------------------------------------------------------------------------
# Heuristic extraction from resume text
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
URL_RE = re.compile(r"(https?://)?(www\.)?([a-z0-9-]+\.)?(linkedin|github|behance|portfolio|devpost|notion)[^\s]*", re.I)
CGPA_RE = re.compile(r"\b(?:c\.?g\.?p\.?a|g\.?p\.?a|percentage|majors?\.?)\s*[:]?\s*([0-9]+(?:\.[0-9]+)?)", re.I)
ROLE_TITLES = [
    "software engineer", "software developer", "backend", "frontend", "full stack",
    "data scientist", "data analyst", "data engineer", "ml engineer", "ai engineer",
    "machine learning", "devops", "cloud", "qa", "test engineer", "sdet",
    "android", "ios", "mobile", "security", "product", "web developer",
    "java developer", "python developer", "ui/ux", "business analyst",
]


def _extract_skills(text: str) -> List[str]:
    found = []
    lower = text.lower()
    for skill in SKILL_TOKENS:
        if re.search(rf"\b{re.escape(skill)}\b", lower):
            found.append(skill.title() if not skill.isupper() else skill)
    return sorted(set(found))


def extract_profile_from_text(text: str) -> Dict[str, Any]:
    """Extract a structured profile from resume text using heuristics."""
    profile = default_profile()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return profile

    # Name: usually the first line if it is short and not a section header
    first = lines[0]
    skip_words = ("resume", "curriculum vitae", "cv", "profile", "summary")
    if len(first) < 40 and first.lower() not in skip_words and not _is_header(first):
        profile["name"] = first

    for email in re.findall(EMAIL_RE, text):
        profile["email"] = email
        break

    match = re.search(PHONE_RE, text)
    if match:
        profile["phone"] = match.group(0).strip()

    for url in re.findall(URL_RE, text):
        full = url[0] or "https://"
        full = full if full.startswith("http") else "https://" + (url[1] or "")
        full += (url[2] or "") + (url[3] or "")
        if "linkedin" in url[3]:
            profile["linkedin"] = full
        elif "github" in url[3]:
            profile["github"] = full

    for cgpa in re.finditer(CGPA_RE, text):
        val = float(cgpa.group(1))
        if 0 <= val <= 10:
            profile["education"]["cgpa"] = str(val)
            break

    profile["skills"] = _extract_skills(text)

    lower_text = text.lower()
    for role in sorted(ROLE_TITLES, key=len, reverse=True):
        if role in lower_text:
            profile["role_preference"] = role.title()
            break

    m = re.search(r"\b(20\d{2})\b", text)
    if m:
        profile["education"]["year"] = m.group(1)

    # Detect remote / on-site preference if stated
    if "remote" in lower_text:
        profile["job_type"] = "remote"

    # Keep the raw text for LLM enrichment
    profile["summary"] = text.strip()[:5000]
    return profile


def _is_header(line: str) -> bool:
    lowered = line.lower()
    headers = ("education", "experience", "skills", "projects", "summary",
               "objective", "certifications", "achievements", "contact")
    return any(lowered.startswith(h) for h in headers)


def enrich_profile_with_llm(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Optionally enrich the extracted profile using the Foundry model.
    Falls back to the heuristic profile if the model call fails.
    """
    try:
        from agents.email_agent import query_llm_text

        summary = profile.get("summary", "").strip()
        if not summary:
            return profile
        prompt = (
            "You are a resume parser. From the resume text below, return a JSON object "
            "with exactly these keys (no markdown, valid JSON only): "
            "name, email, phone, location, education {degree, institution, year, cgpa}, "
            "skills (array of strings), experience (array of {role, company, years}), "
            "projects (array of strings), role_preference, job_type, years_experience.\n\n"
            f"RESUME:\n{summary[:3000]}"
        )
        raw = query_llm_text(prompt, max_tokens=1200)
        import json

        data = json.loads(raw)
        if isinstance(data, dict):
            kept = profile.copy()
            merged = default_profile()
            for k, v in data.items():
                if v not in (None, ""):
                    merged[k] = v
            # Preserve manually-detected string fields that LLM missed
            for f in ("name", "email", "phone", "linkedin", "github"):
                if not merged.get(f) and profile.get(f):
                    merged[f] = profile[f]
            return merged
    except Exception as e:
        logger.warning("LLM enrichment failed, using heuristic profile: %s", e)
    return profile


def parse_resume_file(file_bytes: bytes, filename: str, use_llm: bool = True) -> Dict[str, Any]:
    """Parse an uploaded resume (bytes) into a profile. Callers must handle cleanup."""
    from services import resume_parser

    fd, tmp = tempfile.mkstemp(suffix=os.path.splitext(filename)[1].lower())
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_bytes)
        text = resume_parser.extract_text(tmp)
        profile = extract_profile_from_text(text)
        if use_llm and get_settings().azure.foundry_api_key:
            profile = enrich_profile_with_llm(profile)
        return profile
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass