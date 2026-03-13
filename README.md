# CourseSearch

Compare courses from top colleges — rated, priced, and sorted by distance.

A full-stack app that helps high school students find college admission information using a parallel multi-agent search system.

## Architecture

```
coursesearch/
├── backend/        # FastAPI + multi-agent orchestrator
├── frontend/       # Next.js web app
├── mobile/         # Expo React Native app
└── docker-compose.yml
```

## How it works

Three search agents run in parallel for every query:

| Agent | What it does |
|---|---|
| `LocalCollegesAgent` | Finds colleges in the user's city (spawned only when location is set) |
| `RankedCollegesAgent` | Finds top nationally ranked colleges (NIRF / QS) |
| `AdmissionDetailsAgent` | Deep-dives on fees, entrance exams, eligibility, deadlines |

Results are extracted using **Claude Haiku** (structured JSON from Tavily snippets), with a regex fallback if no Anthropic key is set, and mock data if no Tavily key is set.

## Prerequisites

- Docker & Docker Compose
- (Optional) [Tavily API key](https://tavily.com) for live web search
- (Optional) Anthropic API key for Claude-powered extraction

## Quick Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/sahupra1357/coursesearch.git
   cd coursesearch
   ```

2. **Set API keys** in `frontend/.env.local`:
   ```env
   TAVILY_API_KEY=tvly-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Run with Docker**
   ```bash
   docker compose up --build
   ```

4. Open **http://localhost:3001** in your browser.

> Without API keys the app shows mock data with real college names and links for engineering, medical, management, law, and general streams.

## Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8001" > .env.local
npm run dev
```
Open **http://localhost:3000**

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/search` | Run a course search |
| `GET` | `/saved` | List saved searches |
| `GET` | `/health` | Health check |

**Search request body:**
```json
{ "query": "engineering", "location": "Bangalore" }
```

## Tech Stack

- **Backend**: Python, FastAPI, httpx, Anthropic SDK, Tavily
- **Frontend**: Next.js 14, Tailwind CSS, Radix UI, shadcn/ui
- **Mobile**: Expo, React Native
- **Infra**: Docker Compose
