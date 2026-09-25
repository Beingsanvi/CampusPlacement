"""
Job match agent - scores job openings against a student's profile.

Produces an explainable 0-100 score using weighted signals:
  - skill overlap
  - role/title preference match
  - location / remote preference match
  - education (CGPA mentioned in requirements)
  - experience required vs available
"""

import re
from typing import Any, Dict, List

from services.job_scraper_service import Job

WEIGHTS = {"skills": 0.40, "role": 0.25, "location": 0.15, "cgpa": 0.10, "experience": 0.10}


def _tokens(text: str) -> set:
    return set(re.findall(r"[a-z0-9+#]+", str(text).lower()))


def _skill_names(profile: Dict[str, Any]) -> List[str]:
    skills = profile.get("skills") or []
    return [str(s).strip().lower() for s in skills if str(s).strip()]


def _role_keywords(profile: Dict[str, Any]) -> List[str]:
    role = str(profile.get("role_preference") or "").lower()
    if not role:
        return []
    # e.g. "software engineer" -> ["software", "engineer", "software engineer"]
    words = role.split()
    return words + [role]


def match_job(profile: Dict[str, Any], job: Job) -> Dict[str, Any]:
    """Return a scored match for a single job."""
    reasons: List[str] = []
    matched_skills: List[str] = []
    missing_skills: List[str] = []

    hay = f"{job.title} {job.company} {' '.join(job.tags)} {job.description}".lower()
    hay_tokens = _tokens(hay)

    # 1. Skills — substring + token overlap so short skills still hit
    profile_skills = _skill_names(profile)
    score = 0.0
    if profile_skills:
        hits = []
        for s in profile_skills:
            if not s:
                continue
            if s in hay or any(len(tok) >= 3 and tok in hay_tokens for tok in _tokens(s)):
                hits.append(s)
        matched_skills = list(dict.fromkeys(hits))
        # Full credit with fewer hits so diverse resumes still score competitively
        raw = min(1.0, len(matched_skills) / max(2.0, min(5.0, len(profile_skills))))
        score += WEIGHTS["skills"] * raw
        if matched_skills:
            reasons.append(f"Profile has matching skills: {', '.join(matched_skills[:5])}")
        # Missing skills from job tags
        job_keywords = [t for t in _tokens(f"{' '.join(job.tags)} {job.title}") if t in (
            "python", "java", "sql", "react", "ml", "nlp", "docker", "devops", "linux",
            "javascript", "typescript", "node", "cloud", "azure", "aws", "tensorflow", "pytorch"
        )]
        missing_skills = [k for k in job_keywords if k not in profile_skills]
    else:
        # Resume parsed but no known skills — still allow role/location signals
        reasons.append("No extractable skills on profile; scoring on role and preferences")

    # 1b. Baseline: any real profile gets a small floor so results always appear
    if profile.get("name") or profile_skills:
        score += 0.10
        reasons.append("Profile present — baseline fit applied")

    # 2. Role preference
    role_kw = _role_keywords(profile)
    if role_kw:
        if any(t in hay for t in role_kw):
            score += WEIGHTS["role"]
            reasons.append(f"Job matches preferred role '{profile.get('role_preference')}'")
        elif any(w in job.title.lower() for w in ["engineer", "developer", "analyst", "scientist", "intern"]):
            score += WEIGHTS["role"] * 0.5
            reasons.append("Job role is related to your preferred role")
    elif any(w in job.title.lower() for w in ["engineer", "developer", "analyst", "scientist", "intern"]):
        # No role set — give partial credit for generic technical roles
        score += WEIGHTS["role"] * 0.35
        reasons.append("Technical role — add a role preference for tighter ranking")

    # 3. Location / remote
    pref_type = str(profile.get("job_type") or "").lower()
    if pref_type == "remote" and job.remote:
        score += WEIGHTS["location"]
        reasons.append("Remote position fits your remote preference")
    elif pref_type == "remote":
        reasons.append("This is an on-site role")
    else:
        # match location tokens in profile.location vs job.location roughly
        prof_loc = str(profile.get("location") or "").lower()
        job_loc = job.location.lower()
        if prof_loc and (prof_loc in job_loc or any(t in job_loc for t in prof_loc.split())):
            score += WEIGHTS["location"]
            reasons.append(f"Located near {job.location}")

    # 4. CGPA requirement
    m = re.search(r"(?:cgpa|gpa)[^\d]{0,10}(\d(?:\.\d)?)", hay)
    if m:
        req = float(m.group(1))
        try:
            have = float(profile.get("education", {}).get("cgpa") or 0)
        except (TypeError, ValueError):
            have = 0
        if 0 < req <= 10:
            if have >= req:
                score += WEIGHTS["cgpa"]
                reasons.append(f"Meets CGPA requirement ({req}+)")
            else:
                missing_skills.append(f"CGPA {req}+ required")
                reasons.append(f"CGPA requirement is {req}+ (profile has {have or 'N/A'})")

    # 5. Experience
    exp_m = re.search(r"(\d+)\s*\+?\s*(?:years?|yrs?)", hay)
    if exp_m:
        req_exp = int(exp_m.group(1))
        have_exp = float(profile.get("years_experience") or 0)
        if have_exp >= req_exp:
            score += WEIGHTS["experience"]
            reasons.append(f"Meets {req_exp}+ yrs experience requirement")
        elif have_exp > 0:
            reasons.append(f"Job wants {req_exp}+ yrs; profile has {have_exp}")

    final = round(min(100.0, max(0.0, score * 100)), 1)

    return {
        "score": final,
        "reasons": reasons,
        "matched_skills": matched_skills,
        "missing_skills": list(dict.fromkeys(missing_skills)),
        "is_match": final >= 55,
    }


def match_jobs(profile: Dict[str, Any], jobs: List[Job], limit: int = 15) -> List[Dict[str, Any]]:
    """Score all jobs against the profile and return ranked results."""
    results = []
    for job in jobs:
        detail = match_job(profile, job)
        detail["job"] = job.to_dict()
        results.append(detail)
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]