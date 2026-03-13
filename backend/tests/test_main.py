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

    response = client.post("/search", json={"query": "Computer Science", "location": ""})
    assert response.status_code == 200

    data = response.json()
    assert data["usedMock"] is True
    assert len(data["results"]) > 0
    assert "searchId" in data
    assert "agents" in data


def test_search_result_has_college_info_fields(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "Data Science"})
    assert response.status_code == 200

    for r in response.json()["results"]:
        assert "id" in r
        assert "college" in r
        assert "course" in r
        assert "courseLink" in r
        assert "admissionRequirements" in r
        assert isinstance(r["admissionRequirements"], list)
        assert "isLocal" in r
        assert "foundBy" in r
        assert "score" in r


def test_search_local_colleges_when_location_provided(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "B.Tech CSE", "location": "Bangalore"})
    assert response.status_code == 200

    results = response.json()["results"]
    local = [r for r in results if r["isLocal"]]
    assert len(local) > 0, "Expected at least one local college when location is set"
    assert all(r["location"] == "Bangalore" for r in local)


def test_search_local_comes_first_when_location_set(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "MBA", "location": "Mumbai"})
    results = response.json()["results"]
    # Local results should appear before national ones
    first_non_local = next((i for i, r in enumerate(results) if not r["isLocal"]), len(results))
    last_local = max((i for i, r in enumerate(results) if r["isLocal"]), default=-1)
    assert last_local < first_non_local


def test_search_engineering_mock_has_iit(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "Computer Science Engineering"})
    colleges = [r["college"] for r in response.json()["results"]]
    assert any("IIT" in c for c in colleges)


def test_search_medical_mock_has_aiims(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "MBBS"})
    colleges = [r["college"] for r in response.json()["results"]]
    assert any("AIIMS" in c for c in colleges)


def test_search_without_location(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    response = client.post("/search", json={"query": "MBA"})
    assert response.status_code == 200
    results = response.json()["results"]
    local = [r for r in results if r["isLocal"]]
    assert len(local) == 0, "No local results expected when location not provided"


def test_saved_returns_empty_initially():
    response = client.get("/saved")
    assert response.status_code == 200
    assert response.json()["searches"] == []


def test_search_saves_to_storage(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    client.post("/search", json={"query": "Machine Learning"})

    response = client.get("/saved")
    searches = response.json()["searches"]
    assert len(searches) == 1
    assert searches[0]["query"] == "Machine Learning"
    assert "agents" in searches[0]


def test_multiple_searches_stored(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    client.post("/search", json={"query": "Python Programming"})
    client.post("/search", json={"query": "JavaScript"})

    searches = client.get("/saved").json()["searches"]
    queries = {s["query"] for s in searches}
    assert "Python Programming" in queries
    assert "JavaScript" in queries
