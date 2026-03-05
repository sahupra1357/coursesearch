import json
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
SEARCHES_FILE = DATA_DIR / "searches.json"


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_searches() -> list[dict]:
    ensure_data_dir()
    if not SEARCHES_FILE.exists():
        return []
    try:
        return json.loads(SEARCHES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_search(record: dict) -> None:
    ensure_data_dir()
    searches = get_searches()

    # Deduplicate: same query+location within the last 5 minutes → replace
    five_min_ago = datetime.now(timezone.utc).timestamp() - 300
    filtered = [
        s for s in searches
        if not (
            s["query"].lower() == record["query"].lower()
            and s["location"].lower() == record["location"].lower()
            and datetime.fromisoformat(s["searchedAt"]).timestamp() > five_min_ago
        )
    ]
    filtered.insert(0, record)
    SEARCHES_FILE.write_text(
        json.dumps(filtered[:200], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
