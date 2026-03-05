import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_search_rejects_empty_query():
    response = client.post("/search", json={"query": ""})
    assert response.status_code == 400
    assert "Query is required" in response.json()["detail"]


def test_search_returns_mock_results_without_api_key(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "Python courses", "location": "Bangalore"})
    assert response.status_code == 200

    data = response.json()
    assert data["usedMock"] is True
    assert len(data["results"]) > 0
    assert "searchId" in data


def test_search_result_shape(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "Data Science"})
    assert response.status_code == 200

    results = response.json()["results"]
    for r in results:
        assert "id" in r
        assert "title" in r
        assert "url" in r
        assert "source" in r
        assert "snippet" in r
        assert "score" in r


def test_search_without_location(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "MBA"})
    assert response.status_code == 200
    assert response.json()["usedMock"] is True


def test_saved_returns_empty_initially():
    response = client.get("/saved")
    assert response.status_code == 200
    assert response.json()["searches"] == []


def test_search_saves_to_storage(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    client.post("/search", json={"query": "Machine Learning"})

    response = client.get("/saved")
    assert response.status_code == 200

    searches = response.json()["searches"]
    assert len(searches) == 1
    assert searches[0]["query"] == "Machine Learning"


def test_multiple_searches_stored(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    client.post("/search", json={"query": "Python"})
    client.post("/search", json={"query": "JavaScript"})

    searches = client.get("/saved").json()["searches"]
    queries = {s["query"] for s in searches}
    assert "Python" in queries
    assert "JavaScript" in queries
