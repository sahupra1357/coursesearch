"""
Multi-agent orchestrator for college admission search.

Agents run in parallel:
  - LocalCollegesAgent   — finds colleges in the user's city (only when location set)
  - RankedCollegesAgent  — finds top nationally ranked colleges
  - AdmissionDetailsAgent — searches specifically for fees, requirements, deadlines

Claude claude-haiku extracts structured CollegeInfo from Tavily snippets.
Falls back to regex-pattern extraction if Anthropic key is absent.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel


# ── Result model ──────────────────────────────────────────────────────────────

class CollegeInfo(BaseModel):
    id: str
    college: str
    course: str
    location: str
    isLocal: bool = False
    ranking: Optional[str] = None
    fees: Optional[str] = None
    duration: Optional[str] = None
    admissionRequirements: list[str] = []
    admissionLink: Optional[str] = None
    courseLink: str
    description: str
    deadline: Optional[str] = None
    source: str
    score: float
    foundBy: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _domain(url: str) -> str:
    try:
        return urlparse(url).hostname.lstrip("www.") or url
    except Exception:
        return url


# ── Base agent ────────────────────────────────────────────────────────────────

class SearchAgent:
    name = "SearchAgent"

    def __init__(self, query: str, location: str, tavily_key: str) -> None:
        self.query = query
        self.location = location
        self.tavily_key = tavily_key

    async def _tavily(self, q: str, n: int = 5) -> list[dict]:
        if not self.tavily_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.tavily_key,
                        "query": q,
                        "search_depth": "advanced",
                        "max_results": n,
                        "include_answer": False,
                    },
                )
                if r.status_code == 200:
                    return r.json().get("results", [])
        except Exception:
            pass
        return []

    async def run(self) -> tuple[str, list[dict]]:
        raise NotImplementedError


# ── Specialized agents (run in parallel) ─────────────────────────────────────

class LocalCollegesAgent(SearchAgent):
    """Finds colleges in the user's city — spawned only when location is set."""

    name = "LocalCollegesAgent"

    async def run(self) -> tuple[str, list[dict]]:
        q = (
            f"{self.query} colleges universities in {self.location} "
            f"admission 2025 fees eligibility requirements"
        )
        return self.name, await self._tavily(q, n=5)


class RankedCollegesAgent(SearchAgent):
    """Finds best nationally ranked colleges by NIRF / QS ratings."""

    name = "RankedCollegesAgent"

    async def run(self) -> tuple[str, list[dict]]:
        q = (
            f"best top {self.query} colleges India NIRF ranking 2025 "
            f"admission fees requirements"
        )
        return self.name, await self._tavily(q, n=5)


class AdmissionDetailsAgent(SearchAgent):
    """Deep-dives on entrance exams, eligibility criteria, fees, and deadlines."""

    name = "AdmissionDetailsAgent"

    async def run(self) -> tuple[str, list[dict]]:
        loc = f" {self.location}" if self.location else ""
        q = (
            f"{self.query} admission eligibility entrance exam minimum marks "
            f"required fees scholarship apply{loc} 2025"
        )
        return self.name, await self._tavily(q, n=5)


# ── Extraction ────────────────────────────────────────────────────────────────

async def _extract(
    raw: list[dict],
    query: str,
    location: str,
    agent_name: str,
    is_local: bool,
    anthropic_key: str,
) -> list[CollegeInfo]:
    if not raw:
        return []
    if anthropic_key:
        return await _extract_claude(raw, query, location, agent_name, is_local, anthropic_key)
    return _extract_patterns(raw, query, location, agent_name, is_local)


async def _extract_claude(
    raw: list[dict],
    query: str,
    location: str,
    agent_name: str,
    is_local: bool,
    anthropic_key: str,
) -> list[CollegeInfo]:
    try:
        import anthropic  # optional — graceful fallback if not installed

        client = anthropic.AsyncAnthropic(api_key=anthropic_key)

        snippets = "\n\n".join(
            f"[{i + 1}] Title: {r.get('title', '')}\n"
            f"URL: {r.get('url', '')}\n"
            f"Content: {r.get('content', '')[:600]}"
            for i, r in enumerate(raw)
        )
        loc_ctx = f" in {location}" if location else ""

        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            system=(
                "You help high school students find college admission information. "
                "Extract precise, factual details from search snippets. "
                "Return ONLY valid JSON — no markdown, no explanation."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f'Extract college admission info from these results for "{query}"{loc_ctx}.\n\n'
                    f"{snippets}\n\n"
                    "Return ONE JSON object per search result as a JSON array. Fields:\n"
                    "- college: full official college/university name\n"
                    "- course: exact program name related to the query\n"
                    '- fees: annual fees with currency e.g. "₹2.2L/year" (null if unknown)\n'
                    '- duration: e.g. "4 years" (null if unknown)\n'
                    "- admissionRequirements: array of 2–4 specific requirements "
                    "(entrance exam, min %, age limit)\n"
                    "- admissionLink: direct apply/admission URL if visible in URL, else null\n"
                    "- description: 1–2 sentences about the program\n"
                    "- deadline: application deadline if mentioned, else null\n"
                    "- ranking: NIRF/QS rank if mentioned, else null\n\n"
                    "Return ONLY the JSON array. Use null for unknown fields. "
                    "admissionRequirements must always be an array."
                ),
            }],
        )

        text = resp.content[0].text.strip()
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if not m:
            raise ValueError("No JSON array in Claude response")

        items = json.loads(m.group())
        results: list[CollegeInfo] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            r = raw[i] if i < len(raw) else {}
            url = r.get("url", "")
            results.append(CollegeInfo(
                id=f"{agent_name}-{i}-{int(time.time() * 1000)}",
                college=item.get("college") or "Unknown College",
                course=item.get("course") or query,
                location=location or "India",
                isLocal=is_local,
                ranking=item.get("ranking"),
                fees=item.get("fees"),
                duration=item.get("duration"),
                admissionRequirements=item.get("admissionRequirements") or [],
                admissionLink=item.get("admissionLink"),
                courseLink=url,
                description=item.get("description") or "",
                deadline=item.get("deadline"),
                source=_domain(url),
                score=r.get("score", 0.5),
                foundBy=agent_name,
            ))
        return results

    except Exception:
        return _extract_patterns(raw, query, location, agent_name, is_local)


def _extract_patterns(
    raw: list[dict],
    query: str,
    location: str,
    agent_name: str,
    is_local: bool,
) -> list[CollegeInfo]:
    results: list[CollegeInfo] = []
    for i, r in enumerate(raw):
        content = r.get("content", "")
        title = r.get("title", "")
        url = r.get("url", "")
        score = r.get("score", 0.5)

        # Fees
        fees = None
        for pat in [
            r"(?:₹|Rs\.?\s?|INR\s?)[\d,]+(?:\.[0-9]+)?(?:\s*(?:L|lakh|lacs|k))?"
            r"(?:\s*(?:per\s+year|/year|p\.a\.|annually|per\s+sem(?:ester)?))?",
            r"\$\s*[\d,]+(?:\s*(?:per\s+year|/year|annually))?",
            r"[\d,]+\s*(?:lakhs?|lacs)\s*(?:per\s+year|/year|p\.a\.)?",
        ]:
            m = re.search(pat, content, re.IGNORECASE)
            if m:
                fees = m.group().strip()
                break

        # Entrance exams / requirements
        reqs: list[str] = []
        for pat in [
            r"\b(JEE\s*(?:Main|Advanced)?|NEET(?:\s*UG)?|GATE|CAT|XAT|GMAT|MAT"
            r"|BITSAT|VITEEE|KCET|COMEDK|CUET|CLAT|NATA|PESSAT|MHT[\s-]?CET)\b",
            r"\b10\+2\b[^\n.]{0,60}",
            r"minimum\s+(?:\d{2,3}\s*%|percentile|score)[^\n.]{0,50}",
        ]:
            m = re.search(pat, content, re.IGNORECASE)
            if m:
                reqs.append(m.group().strip()[:120])
        reqs = list(dict.fromkeys(reqs))[:4]

        # Duration
        duration = None
        m = re.search(r"\b(\d[\d.]*)\s*[\-–]?\s*(?:year|yr)s?\b", content, re.IGNORECASE)
        if m:
            duration = f"{m.group(1)} years"

        # Application deadline
        deadline = None
        m = re.search(
            r"(?:apply\s+by|last\s+date|deadline)[^\n.]{0,30}"
            r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
            r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
            r"\s*\d{4}",
            content,
            re.IGNORECASE,
        )
        if m:
            deadline = m.group().strip()

        college = re.split(r"[|\-–]", title)[0].strip()[:80] or f"Institution {i + 1}"

        results.append(CollegeInfo(
            id=f"{agent_name}-{i}-{int(time.time() * 1000)}",
            college=college,
            course=query,
            location=location or "India",
            isLocal=is_local,
            fees=fees,
            duration=duration,
            admissionRequirements=reqs,
            admissionLink=None,
            courseLink=url,
            description=(content[:280] + "…") if len(content) > 280 else content,
            deadline=deadline,
            source=_domain(url),
            score=score,
            foundBy=agent_name,
        ))
    return results


# ── Mock data (when no Tavily key is configured) ──────────────────────────────

_MOCK: dict[str, dict] = {
    "engineering": dict(
        degree="B.Tech", dur="4 years",
        nat_req=["JEE Advanced — top ~2.5 lakh students qualify", "10+2 with PCM, minimum 75%", "Age ≤ 25 years as of 1 Oct 2025"],
        loc_req=["JEE Main / State CET score", "10+2 with PCM, minimum 60%", "Domicile certificate for state quota seats"],
        nat_fee="₹2.2L/year", loc_fee_govt="₹1.2L/year", loc_fee_pvt="₹2.5L/year",
        national=[
            ("IIT Bombay",        "iitb.ac.in",          "#1 Engineering — NIRF 2024", "₹2.2L/year",     "https://www.iitb.ac.in/newacadhome/admissions.jsp",   "April 2025"),
            ("IIT Delhi",         "iitd.ac.in",          "#2 Engineering — NIRF 2024", "₹2.2L/year",     "https://home.iitd.ac.in/admissions.php",              "April 2025"),
            ("BITS Pilani",       "bits-pilani.ac.in",   "Top Private — NIRF 2024",    "₹5.5L/year",     "https://www.bitsadmission.com",                       "May 2025"),
            ("NIT Trichy",        "nitt.edu",            "#8 NIT — NIRF 2024",         "₹1.5L/year",     "https://www.nitt.edu/home/academics/",                "June 2025"),
            ("VIT Vellore",       "vit.ac.in",           "Top Private — QS India",     "₹1.98L/year",    "https://vit.ac.in/admissions",                        "March 2025"),
        ],
    ),
    "medical": dict(
        degree="MBBS", dur="5.5 years (inc. 1-year internship)",
        nat_req=["NEET UG — score ≥ 600 recommended for government seats", "10+2 with PCB + English, minimum 60%", "Age 17–25 years"],
        loc_req=["NEET UG score (state merit list used for seat allotment)", "10+2 with PCB, minimum 50%", "Domicile certificate for state quota"],
        nat_fee="₹15,000/year (govt)", loc_fee_govt="₹15,000/year (govt)", loc_fee_pvt="₹10–12L/year (pvt)",
        national=[
            ("AIIMS New Delhi",   "aiims.edu",           "#1 Medical — NIRF 2024",     "₹1,628/year",    "https://www.aiims.edu/en/notice/entrance-exam.html",  "May 2025"),
            ("JIPMER Puducherry", "jipmer.edu.in",       "#2 Medical — NIRF 2024",     "Minimal (govt)", "https://jipmer.edu.in/admissions",                    "May 2025"),
            ("CMC Vellore",       "cmch-vellore.edu",    "Top Private Medical",        "₹7.5L/year",     "https://admissions.cmch-vellore.edu",                 "March 2025"),
            ("Manipal MAHE",      "manipal.edu",         "#5 Medical — NIRF 2024",     "₹10.5L/year",    "https://manipal.edu/mu/admission.html",               "April 2025"),
            ("AFMC Pune",         "afmc.nic.in",         "Armed Forces Medical",       "Govt-sponsored", "https://afmc.nic.in",                                 "December 2024"),
        ],
    ),
    "management": dict(
        degree="MBA", dur="2 years",
        nat_req=["CAT percentile ≥ 90 for IIM shortlist (XAT / GMAT also accepted)", "Bachelor's degree with minimum 50% marks", "Group Discussion + Personal Interview round"],
        loc_req=["MAT / State CET / CAT score", "Bachelor's degree any stream with 50%", "GD + PI selection round"],
        nat_fee="₹23–25L total", loc_fee_govt="₹3–5L total", loc_fee_pvt="₹6–10L total",
        national=[
            ("IIM Ahmedabad",     "iima.ac.in",          "#1 Management — NIRF 2024",  "₹25L total",     "https://www.iima.ac.in/pgp-admission",                "November 2024"),
            ("IIM Bangalore",     "iimb.ac.in",          "#2 Management — NIRF 2024",  "₹23L total",     "https://www.iimb.ac.in/pgp",                          "November 2024"),
            ("IIM Calcutta",      "iimcal.ac.in",        "#3 Management — NIRF 2024",  "₹23L total",     "https://www.iimcal.ac.in/pgp",                        "November 2024"),
            ("XLRI Jamshedpur",   "xlri.ac.in",          "Top Private B-School",       "₹33L total",     "https://pgdm.xlri.ac.in",                             "November 2024"),
            ("ISB Hyderabad",     "isb.edu",             "Top 1-Year MBA",             "₹40L total",     "https://www.isb.edu/en/programme/pgp.html",            "October 2024"),
        ],
    ),
    "law": dict(
        degree="BA LLB", dur="5 years (integrated) / 3 years (LLB)",
        nat_req=["CLAT score — national merit rank for NLUs", "10+2 with minimum 45% (any stream)", "Age ≤ 20 years for 5-year program"],
        loc_req=["State law entrance exam or CLAT score", "10+2 with minimum 45%", "English proficiency"],
        nat_fee="₹2L/year", loc_fee_govt="₹60,000/year", loc_fee_pvt="₹2–3L/year",
        national=[
            ("NLSIU Bangalore",         "nls.ac.in",       "#1 Law — NIRF 2024",         "₹2.8L/year",     "https://nls.ac.in/admissions/",                      "January 2025"),
            ("NLU Delhi (AILET)",       "nludelhi.ac.in",  "#2 Law — NIRF 2024",         "₹1.9L/year",     "https://nludelhi.ac.in/admission.aspx",               "January 2025"),
            ("NALSAR Hyderabad",        "nalsar.ac.in",    "#3 Law — NIRF 2024",         "₹1.75L/year",    "https://www.nalsar.ac.in/admission",                  "January 2025"),
            ("Symbiosis Law School",    "symlaw.ac.in",    "Top Private Law School",     "₹3.5L/year",     "https://symlaw.ac.in/admissions.php",                 "February 2025"),
            ("Jindal Global Law School","jgu.edu.in",      "Top Int'l Ranking",          "₹5.5L/year",     "https://jgu.edu.in/jgls/admissions/",                 "February 2025"),
        ],
    ),
    "general": dict(
        degree="Bachelor's", dur="3 years",
        nat_req=["CUET score / University merit list", "10+2 with relevant subjects, minimum 55%", "Subject-specific eligibility varies by programme"],
        loc_req=["State entrance exam or merit basis", "10+2 with minimum 50%", "Subject requirements as per stream chosen"],
        nat_fee="₹50,000/year", loc_fee_govt="₹20,000/year", loc_fee_pvt="₹80,000/year",
        national=[
            ("University of Delhi",       "du.ac.in",          "Central University — Top ranked", "₹15,000/year",  "https://du.ac.in/du/index.php?page=admission",       "June 2025"),
            ("Jadavpur University",       "jadavpur.edu",      "#1 State Univ — NIRF",            "₹10,000/year",  "https://jadavpur.edu/admission/",                    "June 2025"),
            ("BHU Varanasi",              "bhu.ac.in",         "Central University",               "₹12,000/year",  "https://bhuonline.in",                               "May 2025"),
            ("Hyderabad University",      "uohyd.ac.in",       "Central University",               "₹18,000/year",  "https://uohyd.ac.in/index.php/admissions",           "June 2025"),
            ("Ashoka University",         "ashoka.edu.in",     "Top Liberal Arts",                 "₹8L/year",      "https://www.ashoka.edu.in/admissions",               "January 2025"),
        ],
    ),
}


def _classify(query: str) -> str:
    q = query.lower()
    if any(k in q for k in ["engineer", "b.tech", "btech", "cse", "computer", "software", "it ", "mechanical", "electrical", "civil", "chemical", "aerospace"]):
        return "engineering"
    if any(k in q for k in ["mbbs", "medical", "medicine", "bds", "pharmacy", "nursing", "bpharm"]):
        return "medical"
    if any(k in q for k in ["mba", "management", "business", "bba", "commerce", "finance", "marketing"]):
        return "management"
    if any(k in q for k in ["law", "llb", "legal", "clat"]):
        return "law"
    return "general"


def _mock_results(query: str, location: str) -> list[CollegeInfo]:
    cat = _mock_data = _MOCK[_classify(query)]
    ts = int(time.time() * 1000)
    out: list[CollegeInfo] = []

    # Local colleges (2 cards — government + private)
    if location:
        for idx, (ctype, fees, ranking) in enumerate([
            ("Government College", cat["loc_fee_govt"], "NAAC A+ | State Rank 1–3"),
            ("Private Institute",  cat["loc_fee_pvt"],  "NAAC A  | NBA Accredited"),
        ]):
            out.append(CollegeInfo(
                id=f"mock-local-{ts}-{idx}",
                college=f"{ctype}, {location}",
                course=f"{cat['degree']} in {query}",
                location=location,
                isLocal=True,
                ranking=ranking,
                fees=fees,
                duration=cat["dur"],
                admissionRequirements=cat["loc_req"],
                admissionLink=None,
                courseLink="https://example.com/courses",
                description=(
                    f"A reputed {'government' if idx == 0 else 'private'} institution in {location} "
                    f"offering {cat['degree']} in {query}. Strong faculty, industry links, "
                    f"and dedicated placement support."
                ),
                deadline="May–June 2025",
                source="example.com",
                score=round(0.90 - idx * 0.05, 2),
                foundBy="LocalCollegesAgent",
            ))

    # National ranked colleges (real names, real links)
    for i, (name, domain, ranking, fees, adm_link, deadline) in enumerate(cat["national"]):
        out.append(CollegeInfo(
            id=f"mock-national-{ts}-{i}",
            college=name,
            course=f"{cat['degree']} in {query}",
            location="India",
            isLocal=False,
            ranking=ranking,
            fees=fees,
            duration=cat["dur"],
            admissionRequirements=cat["nat_req"],
            admissionLink=adm_link,
            courseLink=f"https://{domain}",
            description=(
                f"One of India's premier institutions for {query}. Known for academic "
                f"excellence, research culture, and outstanding alumni network."
            ),
            deadline=deadline,
            source=domain,
            score=round(0.97 - i * 0.03, 2),
            foundBy="RankedCollegesAgent",
        ))

    return out


# ── Orchestrator ──────────────────────────────────────────────────────────────

class AgentOrchestrator:
    def __init__(
        self,
        query: str,
        location: str,
        tavily_key: str,
        anthropic_key: str,
    ) -> None:
        self.query = query
        self.location = location
        self.tavily_key = tavily_key
        self.anthropic_key = anthropic_key

    def _build_agents(self) -> list[SearchAgent]:
        agents: list[SearchAgent] = []
        if self.location:
            agents.append(LocalCollegesAgent(self.query, self.location, self.tavily_key))
        agents.append(RankedCollegesAgent(self.query, self.location, self.tavily_key))
        agents.append(AdmissionDetailsAgent(self.query, self.location, self.tavily_key))
        return agents

    async def run(self) -> dict:
        if not self.tavily_key:
            results = _mock_results(self.query, self.location)
            return {
                "results": [r.model_dump() for r in results],
                "agents": ["MockDataAgent"],
                "usedMock": True,
            }

        agents = self._build_agents()

        # Step 1 — all search agents run in parallel
        raw_outputs = await asyncio.gather(
            *[a.run() for a in agents],
            return_exceptions=True,
        )

        # Step 2 — extract structured info from each agent's results, also in parallel
        extract_tasks = []
        for out in raw_outputs:
            if isinstance(out, Exception) or not out:
                continue
            agent_name, raw = out
            if not raw:
                continue
            extract_tasks.append(_extract(
                raw, self.query, self.location,
                agent_name, agent_name == "LocalCollegesAgent",
                self.anthropic_key,
            ))

        if not extract_tasks:
            results = _mock_results(self.query, self.location)
            return {"results": [r.model_dump() for r in results], "agents": ["MockDataAgent"], "usedMock": True}

        groups = await asyncio.gather(*extract_tasks, return_exceptions=True)

        all_results: list[CollegeInfo] = []
        for g in groups:
            if not isinstance(g, Exception):
                all_results.extend(g)

        # Sort: local colleges first, then by relevance score
        all_results.sort(key=lambda x: (not x.isLocal, -x.score))

        # Deduplicate by college name (first 30 chars, lowercase)
        seen: set[str] = set()
        unique: list[CollegeInfo] = []
        for r in all_results:
            key = r.college.lower().strip()[:30]
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return {
            "results": [r.model_dump() for r in unique],
            "agents": [type(a).__name__ for a in agents],
            "usedMock": False,
        }
