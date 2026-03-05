from datetime import datetime, timezone, timedelta

import storage


def test_get_searches_returns_empty_when_no_file():
    assert storage.get_searches() == []


def test_save_and_retrieve_single_record():
    record = {
        "id": "1",
        "query": "python",
        "location": "",
        "searchedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": 2,
        "results": [],
    }
    storage.save_search(record)

    searches = storage.get_searches()
    assert len(searches) == 1
    assert searches[0]["query"] == "python"
    assert searches[0]["id"] == "1"


def test_save_multiple_different_queries():
    now = datetime.now(timezone.utc).isoformat()
    for i, q in enumerate(["python", "java", "rust"]):
        storage.save_search(
            {"id": str(i), "query": q, "location": "", "searchedAt": now, "resultCount": 1, "results": []}
        )
    searches = storage.get_searches()
    assert len(searches) == 3


def test_deduplication_replaces_recent_same_query():
    now = datetime.now(timezone.utc).isoformat()
    r1 = {"id": "1", "query": "python", "location": "", "searchedAt": now, "resultCount": 2, "results": []}
    r2 = {"id": "2", "query": "Python", "location": "", "searchedAt": now, "resultCount": 5, "results": []}

    storage.save_search(r1)
    storage.save_search(r2)

    searches = storage.get_searches()
    assert len(searches) == 1
    assert searches[0]["id"] == "2"
    assert searches[0]["resultCount"] == 5


def test_no_dedup_for_old_search():
    old_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    storage.save_search(
        {"id": "1", "query": "python", "location": "", "searchedAt": old_time, "resultCount": 2, "results": []}
    )
    storage.save_search(
        {"id": "2", "query": "python", "location": "", "searchedAt": now, "resultCount": 3, "results": []}
    )

    searches = storage.get_searches()
    assert len(searches) == 2


def test_dedup_respects_location():
    now = datetime.now(timezone.utc).isoformat()
    storage.save_search(
        {"id": "1", "query": "python", "location": "Bangalore", "searchedAt": now, "resultCount": 2, "results": []}
    )
    storage.save_search(
        {"id": "2", "query": "python", "location": "Mumbai", "searchedAt": now, "resultCount": 3, "results": []}
    )

    searches = storage.get_searches()
    assert len(searches) == 2


def test_most_recent_search_is_first():
    now = datetime.now(timezone.utc).isoformat()
    storage.save_search({"id": "1", "query": "java", "location": "", "searchedAt": now, "resultCount": 1, "results": []})
    storage.save_search({"id": "2", "query": "python", "location": "", "searchedAt": now, "resultCount": 1, "results": []})

    searches = storage.get_searches()
    assert searches[0]["id"] == "2"
