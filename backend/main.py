import os
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from storage import get_searches, save_search

# Load TAVILY_API_KEY from frontend/.env.local
load_dotenv(Path(__file__).parent.parent / "frontend" / ".env.local")

app = FastAPI(title="CourseSearch Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    location: str = ""


class WebResult(BaseModel):
    id: str
    title: str
    url: str
    source: str
    snippet: str
    score: float


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_domain(url: str) -> str:
    try:
        return urlparse(url).hostname.lstrip("www.") or url
    except Exception:
        return url


def mock_results(query: str, location: str) -> list[dict]:
    loc = f" in {location}" if location else ""
    return [
        {
            "id": f"mock-{i}",
            "title": title,
            "url": url,
            "source": extract_domain(url),
            "snippet": snippet,
            "score": score,
        }
        for i, (title, url, snippet, score) in enumerate(
            [
                (
                    f"Top {query} Courses{loc} — 2025 Guide",
                    "https://example.com/courses",
                    f"Discover the best {query} courses{loc}. Compare curriculum, fees, duration, and placement records from leading institutes.",
                    0.95,
                ),
                (
                    f"{query} Online Certificate Programs — Coursera",
                    "https://coursera.org",
                    f"Learn {query} from world-class instructors. Earn certificates from top universities with flexible online schedules.",
                    0.91,
                ),
                (
                    f"Best Institutes for {query}{loc} — Rankings",
                    "https://education.example.com/rankings",
                    f"Annual ranking of the best colleges and institutes offering {query} programs{loc}. Includes fees, placement stats, and alumni reviews.",
                    0.87,
                ),
                (
                    f"{query} Bootcamp vs Degree — Which Is Right?",
                    "https://blog.example.com/bootcamp-vs-degree",
                    f"A comprehensive comparison of bootcamps and degree programs for {query}. Analyse cost, duration, and career outcomes.",
                    0.82,
                ),
                (
                    f"Free {query} Resources & Learning Paths",
                    "https://freecodecamp.org",
                    f"Free online learning resources for {query}. Structured paths, coding challenges, and a community of millions of learners.",
                    0.78,
                ),
            ],
            start=1,
        )
    ]


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/search")
async def search(req: SearchRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    location = req.location.strip()
    tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    used_mock = False

    if tavily_key:
        search_query = f"{query} courses {location}" if location else f"{query} courses"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": tavily_key,
                        "query": search_query,
                        "search_depth": "basic",
                        "max_results": 10,
                        "include_answer": False,
                    },
                )
            if resp.status_code == 200:
                data = resp.json()
                results = [
                    {
                        "id": f"{int(time.time() * 1000)}-{i}",
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "source": extract_domain(r.get("url", "")),
                        "snippet": (r.get("content") or "")[:350],
                        "score": r.get("score", 0.0),
                    }
                    for i, r in enumerate(data.get("results", []))
                ]
            else:
                results = mock_results(query, location)
                used_mock = True
        except Exception:
            results = mock_results(query, location)
            used_mock = True
    else:
        results = mock_results(query, location)
        used_mock = True

    record = {
        "id": str(int(time.time() * 1000)),
        "query": query,
        "location": location,
        "searchedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "resultCount": len(results),
        "results": results,
    }
    save_search(record)

    return {"results": results, "searchId": record["id"], "usedMock": used_mock}


@app.get("/saved")
async def saved():
    return {"searches": get_searches()}


@app.get("/health")
async def health():
    return {"status": "ok"}
