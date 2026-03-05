import pytest
import storage


@pytest.fixture(autouse=True)
def use_tmp_storage(tmp_path, monkeypatch):
    """Redirect all storage reads/writes to a temp directory for test isolation."""
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)
    monkeypatch.setattr(storage, "SEARCHES_FILE", tmp_path / "searches.json")
    yield
