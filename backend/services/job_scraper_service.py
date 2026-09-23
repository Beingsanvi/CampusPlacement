"""
Job scraper service - pulls live openings from free sources.

Sources (no API keys required):
  - Jobicy: https://jobicy.com/api/v2/remote-jobs
  - Remotive: https://remotive.com/api/remote-jobs
  - Hacker News "Who is hiring?" thread via the Algolia API

Results are cached to disk (backend/data/jobs_cache.json) and deduplicated.
If every source fails (e.g. no network), a small set of sample jobs is returned
so the demo still works.
"""

import hashlib
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

import requests

from config.settings import get_settings
from services import storage

logger = logging.getLogger(__name__)

CACHE_FILE = "jobs_cache.json"
TIMEOUT = 12


@dataclass
class Job:
    id: str
    title: str
    company: str
    location: str
    remote: bool = False
    salary: str = ""
    url: str = ""
    description: str = ""
    tags: List[str] = field(default_factory=list)
    source: str = ""
    posted_date: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Sample fallback jobs (used when no live source can be reached)
# ---------------------------------------------------------------------------

SAMPLE_JOBS = [
    Job(
        id="sample_technova_swe", title="Software Engineer", company="TechNova Solutions",
        location="Chandigarh, India", remote=False, salary="8-12 LPA",
        url="https://technova.example/careers/swe",
        description="Python/Java developer. SQL basics, data structures & algorithms. "
                    "CSE/AI/IT. Min CGPA 7.0. No active backlogs.",
        tags=["python", "java", "dsa", "sql"], source="sample",
    ),
    Job(
        id="sample_datasphere_da", title="Data Analyst", company="DataSphere Analytics",
        location="Chandigarh, India", remote=False, salary="9-13 LPA",
        url="https://datasphere.example/careers/da",
        description="SQL proficiency, Python for data, statistics, ML basics. "
                    "CSE/AI/ECE/IT. Min CGPA 7.5.",
        tags=["sql", "python", "statistics", "ml"], source="sample",
    ),
    Job(
        id="sample_cloudnova_devops", title="DevOps Engineer", company="CloudNova Technologies",
        location="Bengaluru, India", remote=True, salary="10-15 LPA",
        url="https://cloudnova.example/careers/devops",
        description="Programming fundamentals, cloud basics, Linux, Docker. "
                    "CSE/AI/IT. Min CGPA 7.2.",
        tags=["devops", "cloud", "linux", "docker"], source="sample",
    ),
    Job(
        id="sample_ml_engineer", title="Machine Learning Engineer", company="NexaLabs AI",
        location="Remote", remote=True, salary="12-18 LPA",
        url="https://nexalabs.example/careers/mle",
        description="Python, PyTorch/TensorFlow, NLP, data pipelines. "
                    "Strong CS fundamentals and ML systems.",
        tags=["python", "ml", "nlp", "pytorch"], source="sample",
    ),
    Job(
        id="sample_backend", title="Backend Developer", company="StripeWave",
        location="Hyderabad, India", remote=False, salary="9-14 LPA",
        url="https://stripewave.example/careers/backend",
        description="REST APIs, Node.js/Python, PostgreSQL, Redis, microservices.",
        tags=["backend", "python", "node.js", "postgresql", "rest api"], source="sample",
    ),
    Job(
        id="sample_frontend", title="Frontend Developer", company="PixelForge",
        location="Remote", remote=True, salary="7-11 LPA",
        url="https://pixelforge.example/careers/frontend",
        description="React, TypeScript, HTML/CSS, responsive design.",
        tags=["react", "javascript", "typescript", "html", "css"], source="sample",
    ),
]


# ---------------------------------------------------------------------------
# Fetching helpers
# ---------------------------------------------------------------------------

def _get_json(url: str) -> Optional[Any]:
    try:
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("Request failed for %s: %s", url, e)
        return None


def _fetch_jobicy() -> List[Job]:
    data = _get_json("https://jobicy.com/api/v2/remote-jobs?count=50")
    if not data or not isinstance(data, dict):
        return []
    jobs = []
    for j in data.get("jobs", []) or []:
        industry = j.get("jobIndustry") or []
        tags = [t for t in (industry if isinstance(industry, list) else [industry]) if t]
        jobs.append(Job(
            id=_stable_id("jobicy", j.get("id") or j.get("jobTitle")),
            title=j.get("jobTitle", ""),
            company=j.get("companyName", ""),
            location=j.get("jobGeo") or "Remote",
            remote=True,
            salary=j.get("salaryMax") or j.get("salaryMin") or "",
            url=j.get("url", ""),
            description=j.get("jobDescription", "") or "",
            tags=tags,
            source="jobicy",
            posted_date=j.get("pubDate", ""),
        ))
    return jobs


def _fetch_remotive() -> List[Job]:
    data = _get_json("https://remotive.com/api/remote-jobs?limit=50")
    jobs = []
    if not data or not isinstance(data, dict):
        return jobs
    for j in data.get("jobs", []) or []:
        jobs.append(Job(
            id=_stable_id("remotive", j.get("id")),
            title=j.get("title", ""),
            company=j.get("company_name", ""),
            location=j.get("candidate_required_location") or "Remote",
            remote=True,
            salary=j.get("salary") or "",
            url=j.get("url", ""),
            description=j.get("content", "") or "",
            tags=(j.get("tags") or [])[:6],
            source="remotive",
            posted_date=j.get("publication_date", ""),
        ))
    return jobs


_HN_PARTIAL_RE = re.compile(r"^([^|]{1,80})\s*\|\s*([^|]{1,120})?\s*\|?\s*((?:REMOTE|ONSITE|OFFICE).*)?$", re.I)


def _fetch_hn() -> List[Job]:
    stories = _get_json(
        "https://hn.algolia.com/api/v1/search?tags=story&query=who%20is%20hiring&hitsPerPage=3"
    )
    jobs = []
    if not stories or not isinstance(stories, dict):
        return jobs
    seen = set()
    for hit in (stories.get("hits") or []):
        item = _get_json(f"https://hn.algolia.com/api/v1/items/{hit.get('objectID')}")
        if not item:
            continue
        for child in item.get("children") or []:
            text = (child.get("text") or "").strip()
            if not text or len(text) < 30:
                continue
            first_line = text.splitlines()[0][:200]
            m = _HN_PARTIAL_RE.match(first_line)
            if not m:
                continue
            company = m.group(1).strip()
            title = m.group(2).strip() if m.group(2) else "Engineer"
            remote_note = (m.group(3) or "").upper()
            loc = "Remote" if "REMOTE" in remote_note else "Onsite (US)"
            key = (company.lower(), title.lower())
            if key in seen:
                continue
            seen.add(key)
            jobs.append(Job(
                id=_stable_id("hn", child.get("id")),
                title=title,
                company=company,
                location=loc,
                remote="REMOTE" in remote_note,
                description=text[:2000],
                tags=[],
                source="hn",
            ))
    return jobs


def _stable_id(source: str, raw: Any) -> str:
    return hashlib.sha1(f"{source}|{raw}".encode("utf-8")).hexdigest()[:12]


def _all_sources() -> List[Job]:
    jobs: List[Job] = []
    for fn in (_fetch_jobicy, _fetch_remotive, _fetch_hn):
        try:
            jobs.extend(fn())
        except Exception as e:
            logger.warning("Source %s failed: %s", fn.__name__, e)
    return jobs


def _dedup(jobs: List[Job]) -> List[Job]:
    seen, unique = set(), []
    for job in jobs:
        if not job.title or not job.company:
            continue
        key = (job.title.lower().strip(), job.company.lower().strip())
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_jobs(force_refresh: bool = False) -> List[Job]:
    """Fetch jobs with disk cache + sample fallback."""
    cfg = get_settings()
    cache: Optional[list] = storage.read_json(CACHE_FILE, default=None)
    now = time.time()
    if cache and not force_refresh:
        try:
            if now - cache.get("cached_at", 0) < cfg.app.jobs_cache_ttl_seconds:
                return [Job(**j) for j in cache.get("jobs", [])]
        except (TypeError, ValueError) as e:
            logger.warning("Cache invalid, skipping: %s", e)

    jobs = _all_sources()
    if not jobs:
        jobs = SAMPLE_JOBS
        logger.warning("No live job sources reached; using sample jobs.")
    jobs = _dedup(jobs)[: cfg.app.jobs_max_per_source * 3]

    storage.write_json(CACHE_FILE, {"cached_at": now, "jobs": [asdict(j) for j in jobs]})
    return jobs


def search_jobs(q: str = "", location: str = "", remote_only: bool = False, limit: int = 20) -> List[Job]:
    jobs = get_jobs()
    q_words = [w.lower() for w in re.split(r"\W+", q) if w] if q else []
    loc_words = [w.lower() for w in re.split(r"\W+", location) if w] if location else []
    matched = []

    for job in jobs:
        hay = f"{job.title} {job.company} {' '.join(job.tags)} {job.description}".lower()
        if q_words and not all(w in hay for w in q_words):
            continue
        if loc_words:
            lh = f"{job.location} {job.description}".lower()
            if not any(w in lh for w in loc_words):
                continue
        if remote_only and not job.remote:
            continue
        matched.append(job)

    matched.sort(key=lambda j: j.posted_date or "", reverse=True)
    return matched[:limit]