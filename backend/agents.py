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
from fastapi import HTTPException
from pydantic import BaseModel


# ── Result model ──────────────────────────────────────────────────────────────

class CollegeInfo(BaseModel):
    id: str
    college: str
    course: str
    location: str
    country: Optional[str] = None   # country where the college is located
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


# ── Country → university rating agency mapping ────────────────────────────────

COUNTRY_RATING_AGENCIES: dict[str, str] = {
    "united states": "US News & World Report",
    "usa": "US News & World Report",
    "india": "NIRF",
    "united kingdom": "Times Higher Education",
    "great britain": "Times Higher Education",
    "australia": "Good Universities Guide QS",
    "canada": "Maclean's University Rankings",
    "germany": "CHE University Ranking",
    "france": "L'Etudiant classement",
    "china": "QS China",
    "japan": "QS Japan",
    "south korea": "JoongAng University Ranking",
    "singapore": "QS Singapore",
    "malaysia": "QS Malaysia",
    "pakistan": "HEC Pakistan",
    "bangladesh": "UGC Bangladesh",
    "sri lanka": "QS Sri Lanka",
    "new zealand": "QS New Zealand",
    "ireland": "Times Higher Education",
    "netherlands": "Keuzegids",
    "sweden": "QS Nordic",
    "norway": "QS Nordic",
    "denmark": "QS Nordic",
    "brazil": "Ranking Universitário Folha",
    "mexico": "QS Latin America",
    "argentina": "QS Latin America",
    "colombia": "QS Latin America",
    "chile": "QS Latin America",
    "south africa": "QS Africa",
    "nigeria": "NUC ranking",
    "kenya": "QS Africa",
    "egypt": "QS Arab Region",
    "saudi arabia": "QS Arab Region",
    "uae": "QS Arab Region",
    "united arab emirates": "QS Arab Region",
    "russia": "QS Russia",
    "italy": "CENSIS ranking",
    "spain": "QS Ibero America",
    "portugal": "QS Ibero America",
    "switzerland": "QS Switzerland",
    "indonesia": "QS Asia",
    "philippines": "QS Asia",
    "thailand": "QS Asia",
    "vietnam": "QS Asia",
}


def _get_rating_agency(location: str) -> str:
    """Return the authoritative university rating agency for a given location string."""
    loc_lower = location.lower()
    for country, agency in COUNTRY_RATING_AGENCIES.items():
        if country in loc_lower:
            return agency
    return "QS World University Rankings"


def _get_expected_country(location: str) -> str:
    """Return the canonical country name for a given location string, or '' if unknown."""
    loc_lower = location.lower()
    for country in COUNTRY_RATING_AGENCIES:
        if country in loc_lower:
            return country
    return ""


def _filter_by_country(results: list[CollegeInfo], expected_country: str) -> list[CollegeInfo]:
    """Hard-filter results to only include colleges from the expected country."""
    if not expected_country:
        return results
    filtered = [
        r for r in results
        if r.country and expected_country in r.country.lower()
    ]
    # Fall back to unfiltered only if the LLM returned no country fields at all
    if not filtered and all(r.country is None for r in results):
        return results
    return filtered


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
    """Finds best nationally ranked colleges using the country's authoritative rating agency."""

    name = "RankedCollegesAgent"

    async def run(self) -> tuple[str, list[dict]]:
        loc = f" {self.location}" if self.location else ""
        agency = _get_rating_agency(self.location) if self.location else "QS World University Rankings"
        q = (
            f"best top {self.query} colleges{loc} {agency} ranking 2025 "
            f"admission fees requirements"
        )
        return self.name, await self._tavily(q, n=5)


class AdmissionDetailsAgent(SearchAgent):
    """Deep-dives on entrance exams, eligibility criteria, fees, and deadlines."""

    name = "AdmissionDetailsAgent"

    async def run(self) -> tuple[str, list[dict]]:
        loc = f" {self.location}" if self.location else ""
        agency = _get_rating_agency(self.location) if self.location else "QS World University Rankings"
        q = (
            f"{self.query} admission eligibility entrance exam fees scholarship{loc} "
            f"{agency} 2025"
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
    openai_key: str = "",
) -> list[CollegeInfo]:
    if not raw:
        return []
    if anthropic_key:
        return await _extract_claude(raw, query, location, agent_name, is_local, anthropic_key)
    if openai_key:
        return await _extract_openai(raw, query, location, agent_name, is_local, openai_key)
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
        country_filter = (
            f"IMPORTANT: Only extract colleges/universities located in or relevant to {location}. "
            f"Skip any result from a different country.\n\n"
        ) if location else ""

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
                    f"{country_filter}"
                    f"{snippets}\n\n"
                    "Return ONE JSON object per search result as a JSON array. Fields:\n"
                    "- college: full official college/university name\n"
                    "- course: exact program name related to the query\n"
                    "- country: country where the college is located (e.g. 'India', 'United States')\n"
                    '- fees: annual fees with currency e.g. "₹2.2L/year" (null if unknown)\n'
                    '- duration: e.g. "4 years" (null if unknown)\n'
                    "- admissionRequirements: array of 2–4 specific requirements "
                    "(entrance exam, min %, age limit)\n"
                    "- admissionLink: direct apply/admission URL if visible in URL, else null\n"
                    "- description: 1–2 sentences about the program\n"
                    "- deadline: application deadline if mentioned, else null\n"
                    "- ranking: country ranking if mentioned, else null\n\n"
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
                location=location or "",
                country=item.get("country"),
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


async def _extract_openai(
    raw: list[dict],
    query: str,
    location: str,
    agent_name: str,
    is_local: bool,
    openai_key: str,
) -> list[CollegeInfo]:
    try:
        import openai  # optional — graceful fallback if not installed

        client = openai.AsyncOpenAI(api_key=openai_key)

        snippets = "\n\n".join(
            f"[{i + 1}] Title: {r.get('title', '')}\n"
            f"URL: {r.get('url', '')}\n"
            f"Content: {r.get('content', '')[:600]}"
            for i, r in enumerate(raw)
        )
        loc_ctx = f" in {location}" if location else ""
        country_filter = (
            f"IMPORTANT: Only extract colleges/universities located in or relevant to {location}. "
            f"Skip any result from a different country.\n\n"
        ) if location else ""

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=2000,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You help high school students find college admission information. "
                        "Extract precise, factual details from search snippets. "
                        "Return ONLY valid JSON — no markdown, no explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Extract college admission info from these results for "{query}"{loc_ctx}.\n\n'
                        f"{country_filter}"
                        f"{snippets}\n\n"
                        "Return ONE JSON object per search result as a JSON array. Fields:\n"
                        "- college: full official college/university name\n"
                        "- course: exact program name related to the query\n"
                        "- country: country where the college is located (e.g. 'India', 'United States')\n"
                        '- fees: annual fees with currency e.g. "₹2.2L/year" (null if unknown)\n'
                        '- duration: e.g. "4 years" (null if unknown)\n'
                        "- admissionRequirements: array of 2–4 specific requirements "
                        "(entrance exam, min %, age limit)\n"
                        "- admissionLink: direct apply/admission URL if visible in URL, else null\n"
                        "- description: 1–2 sentences about the program\n"
                        "- deadline: application deadline if mentioned, else null\n"
                        "- ranking: country ranking if mentioned, else null\n\n"
                        "Return ONLY the JSON array. Use null for unknown fields. "
                        "admissionRequirements must always be an array."
                    ),
                },
            ],
        )

        text = resp.choices[0].message.content.strip()
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if not m:
            raise ValueError("No JSON array in OpenAI response")

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
                location=location or "",
                country=item.get("country"),
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
            location=location or "",
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


# ── Orchestrator ──────────────────────────────────────────────────────────────

class AgentOrchestrator:
    def __init__(
        self,
        query: str,
        location: str,
        tavily_key: str,
        anthropic_key: str,
        openai_key: str = "",
    ) -> None:
        self.query = query
        self.location = location
        self.tavily_key = tavily_key
        self.anthropic_key = anthropic_key
        self.openai_key = openai_key

    def _build_agents(self) -> list[SearchAgent]:
        agents: list[SearchAgent] = []
        if self.location:
            agents.append(LocalCollegesAgent(self.query, self.location, self.tavily_key))
        agents.append(RankedCollegesAgent(self.query, self.location, self.tavily_key))
        agents.append(AdmissionDetailsAgent(self.query, self.location, self.tavily_key))
        return agents

    async def run(self) -> dict:
        if not self.tavily_key:
            raise HTTPException(
                status_code=503,
                detail="TAVILY_API_KEY is not configured. Set it in your .env.local to enable search.",
            )

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
                self.anthropic_key, self.openai_key,
            ))

        if not extract_tasks:
            raise HTTPException(
                status_code=502,
                detail="Search returned no results. The Tavily API may be unavailable or the query returned nothing.",
            )

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

        # Hard-filter to expected country so results never mix countries
        expected_country = _get_expected_country(self.location)
        if expected_country:
            unique = _filter_by_country(unique, expected_country)

        return {
            "results": [r.model_dump() for r in unique],
            "agents": [type(a).__name__ for a in agents],
        }
