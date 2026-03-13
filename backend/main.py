import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import AgentOrchestrator
from storage import get_searches, save_search

# Load TAVILY_API_KEY / ANTHROPIC_API_KEY from frontend/.env.local when running locally
load_dotenv(Path(__file__).parent.parent / "frontend" / ".env.local")

app = FastAPI(title="CourseSearch Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    location: str = ""


@app.post("/search")
async def search(req: SearchRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    orchestrator = AgentOrchestrator(
        query=query,
        location=req.location.strip(),
        tavily_key=os.getenv("TAVILY_API_KEY", "").strip(),
        anthropic_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
    )

    result = await orchestrator.run()

    record = {
        "id": str(int(time.time() * 1000)),
        "query": query,
        "location": req.location.strip(),
        "searchedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": len(result["results"]),
        "results": result["results"],
        "agents": result["agents"],
    }
    save_search(record)

    return {
        "results": result["results"],
        "agents": result["agents"],
        "searchId": record["id"],
        "usedMock": result["usedMock"],
    }


@app.get("/saved")
async def saved():
    return {"searches": get_searches()}


@app.get("/health")
async def health():
    return {"status": "ok"}
