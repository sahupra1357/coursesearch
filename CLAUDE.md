# CourseSearch — Claude Code Guide

## What this app is

CourseSearch helps **high school students** figure out what to study next. A student types a topic they're curious about ("data science", "architecture", "nursing") and the app spawns multiple parallel search agents to answer three questions:

1. **Which colleges near me offer this?** (local first — most actionable)
2. **What are the top-ranked colleges for this nationally?** (ambition track)
3. **Are there good online courses I can start right now?** (immediate access)

Results come back ranked in that priority order: local colleges → national colleges → online courses.

---

## System Prompt (for AI development sessions)

Use this when starting a Claude Code session on this project:

```
You are improving CourseSearch, a web application built for high school students who
are exploring what to study in college. These are 16–18-year-olds who are curious but
uncertain — they don't know the right search terms, they don't know what's near them,
and they find dense information overwhelming.

Your job when making changes to this codebase:

PRODUCT PRINCIPLES
- Clarity over completeness. One clear answer beats five confusing ones.
- Local first. If a student is in Bangalore, Bangalore colleges must appear before
  IIT Delhi, even if IIT Delhi is "better." The most actionable result wins.
- Online is a valid path. Coursera, edX, Khan Academy, Udemy are real options for
  students who can't relocate or afford college fees. Treat them as first-class results,
  not fallbacks.
- Never overwhelm. Students are already anxious. Surfaces only what matters: cost,
  duration, how to get in, whether enrollment is open.
- Friendly but factual. No marketing fluff in descriptions. Real fees, real deadlines,
  real exam names.

SEARCH PRIORITY ORDER (always enforce this)
  1. Local college courses (city or state where user is located)
  2. National top-ranked college courses (using country's authoritative ranking agency)
  3. Online courses (Coursera, edX, Udemy, Khan Academy, NPTEL — globally available)

ARCHITECTURE RULES
- Agents run in parallel. Never make search agents depend on each other's results.
- Claude Haiku extracts structured data from Tavily snippets. OpenAI gpt-4o-mini is
  the fallback. Regex patterns are the last resort.
- The CollegeInfo model in agents.py is the single source of truth for result shape.
  If you add a field there, add it to frontend/lib/types.ts CollegeResult and update
  the results-table.tsx card render too.
- Location detection flow: GPS → reverse-geocode (Nominatim) → IP geolocation (ipwho.is)
  → ask user. Never skip location silently.

TECH STACK
- Backend: Python 3.14, FastAPI, httpx, anthropic SDK, Tavily API
- Frontend: Next.js 14 (App Router), Tailwind CSS, shadcn/ui components
- Mobile: Expo + React Native (mirrors the web frontend)
- Infra: Docker Compose (backend on :8001, frontend on :3001)

WHAT NOT TO DO
- Do not add mock data. Real search results only.
- Do not add new UI sections without wiring them to real agent output.
- Do not remove the regex fallback in _extract_patterns — it runs when no AI key is set.
- Do not skip deduplication. Agents often return the same college; deduplicate by
  college name (first 30 chars, lowercase) before returning.
- Do not mix countries in results. If location is "Bangalore", filter out US colleges.
```

---

## User Prompt Template (for search result extraction)

This is the prompt sent to Claude Haiku (and OpenAI fallback) inside `backend/agents.py`
when extracting structured results from Tavily search snippets.

**System message:**
```
You help high school students (age 16–18) find the right next step after school.
Your job is to extract accurate, student-friendly information from web search results.

Rules:
- Extract only what is explicitly stated in the snippets. Do not guess or hallucinate fees,
  rankings, or deadlines.
- If a result is an online course (Coursera, edX, Udemy, NPTEL, Khan Academy, YouTube),
  set type to "online". Otherwise set type to "college".
- Fees must include the currency symbol and time period (e.g. "₹2.2L/year", "$499/month",
  "Free"). Use null if not mentioned.
- admissionRequirements must be concrete: entrance exam name, minimum percentage, age
  limit. Not vague phrases like "good academic record".
- description must be 1–2 sentences a 16-year-old can understand. No jargon.
- Return ONLY valid JSON. No markdown, no explanation, no trailing text.
```

**User message template** (variables in `{}`):
```
Extract course/college information from these search results for the topic: "{query}"{loc_context}.

{country_filter}

Search results:
{snippets}

Return a JSON array. One object per result. Fields:
- college: full official name of the college, university, or platform (e.g. "Coursera", "IIT Bombay")
- course: exact program or course name matching "{query}"
- type: "college" or "online"
- country: country where the college is located, or "Global" for online platforms
- fees: cost with currency and period, or null
- duration: e.g. "4 years", "6 weeks", "Self-paced", or null
- admissionRequirements: array of 2–4 specific, concrete requirements. Empty array if none found.
- admissionLink: direct application or enrollment URL if present in the result URL, else null
- description: 1–2 plain sentences about what the program teaches and who it is for
- deadline: application or enrollment deadline if mentioned, else null
- ranking: national or global ranking if mentioned (e.g. "NIRF #3"), else null

Return ONLY the JSON array. Use null for unknown fields.
admissionRequirements must always be an array, never null.
```

---

## Current Agent Architecture

```
AgentOrchestrator.run()
  │
  ├── [parallel] LocalCollegesAgent      → Tavily: "{query} colleges in {location} admission fees"
  ├── [parallel] RankedCollegesAgent     → Tavily: "best {query} colleges {location} {rating_agency} 2025"
  ├── [parallel] AdmissionDetailsAgent   → Tavily: "{query} admission eligibility entrance exam {location}"
  └── [TODO] OnlineCoursesAgent          → Tavily: "{query} online course Coursera edX NPTEL certificate"
       │
       └── _extract() for each agent (also parallel)
             ├── _extract_claude()   (if ANTHROPIC_API_KEY set)
             ├── _extract_openai()   (elif OPENAI_API_KEY set)
             └── _extract_patterns() (regex fallback)
```

**Sort order:** isLocal=True first → score descending → deduplicate by college name → country filter

---

## Next Enhancements (priority order)

### 1. Add OnlineCoursesAgent (HIGH PRIORITY)
Add a fourth agent in `backend/agents.py` that searches for online courses. Results should
have `isLocal=False` and a new field `isOnline=True` so the frontend can render a third
section "Learn Online Now" below local and national colleges.

Steps:
- Add `isOnline: bool = False` to `CollegeInfo` in `agents.py`
- Add `isOnline` to `CollegeResult` in `frontend/lib/types.ts`
- Create `OnlineCoursesAgent` class in `agents.py`
- Wire it into `AgentOrchestrator._build_agents()` — always include it regardless of location
- Add the "Learn Online Now" section in `frontend/components/course-search/results-table.tsx`
  with a Globe icon and distinct purple/indigo accent color

### 2. Improve extraction prompt (MEDIUM PRIORITY)
The current extraction prompt in `_extract_claude()` and `_extract_openai()` should be
replaced with the User Prompt Template above. Also add the `type` field extraction so
the backend knows if a result is a college or an online platform.

### 3. Career path suggestions (LOW PRIORITY)
After results load, show a "What can you do with {query}?" section using a lightweight
Claude call that lists 4–5 career paths for the queried subject. Keep it brief — one
sentence per career path.

### 4. Mobile parity (LOW PRIORITY)
`mobile/app/(tabs)/index.tsx` should match the web search flow including the online
courses section and the three-tier result display.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `TAVILY_API_KEY` | Yes | Web search (all agents) |
| `ANTHROPIC_API_KEY` | Recommended | Claude Haiku extraction |
| `OPENAI_API_KEY` | Optional | GPT-4o-mini fallback extraction |
| `NEXT_PUBLIC_BACKEND_URL` | Yes (frontend) | Backend URL |

Set in root `.env` for local dev. Docker uses `env_file` in `docker-compose.yml`.

---

## Coding Behavior Guidelines

These apply to every change made in this codebase. They bias toward caution over speed — use judgment on trivial tasks.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that **your** changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Clarifying questions come **before** implementation, not after mistakes.

---

## Dev Commands

```bash
# Backend (local)
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8001

# Frontend (local)
cd frontend && npm run dev          # http://localhost:3000

# Both via Docker
docker compose up --build           # backend :8001, frontend :3001

# Tests
cd backend && pytest
cd frontend && npm test
```
