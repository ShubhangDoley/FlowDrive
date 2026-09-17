import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data


def test_cron_cleanup_endpoint():
    response = client.get("/api/v1/cron/cleanup")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Cleanup executed" in data["message"]
