"""Tests for the caching layer (backend.cache)."""

import json

from fastapi.testclient import TestClient

from backend.cache import DictCache, config_cache_key, get_cache, reset_cache


# ---------------------------------------------------------------------------
# DictCache unit tests
# ---------------------------------------------------------------------------


def test_dict_cache_get_returns_none_for_missing_key():
    cache = DictCache()
    assert cache.get("nonexistent") is None
    assert cache.misses == 1


def test_dict_cache_set_and_get():
    cache = DictCache()
    cache.set("k1", {"accuracy": 98.5})
    result = cache.get("k1")
    assert result == {"accuracy": 98.5}
    assert cache.hits == 1


def test_dict_cache_ttl_expiry():
    import time

    cache = DictCache()
    cache.set("k2", "value", ttl=0)  # expires immediately (0 seconds TTL)
    time.sleep(0.05)
    assert cache.get("k2") is None
    assert cache.misses == 1


def test_dict_cache_exists():
    cache = DictCache()
    assert cache.exists("missing") is False
    cache.set("present", 1)
    assert cache.exists("present") is True


def test_dict_cache_stats():
    cache = DictCache()
    cache.set("a", 1)
    cache.get("a")
    cache.get("b")
    stats = cache.stats()
    assert stats["backend"] == "memory"
    assert stats["keys"] == 1
    assert stats["hits"] == 1
    assert stats["misses"] == 1


# ---------------------------------------------------------------------------
# Config hashing
# ---------------------------------------------------------------------------


def test_config_cache_key_is_deterministic():
    config = {"learning_rate": 0.001, "batch_size": 64, "epochs": 10, "optimizer": "adam"}
    key1 = config_cache_key(config)
    key2 = config_cache_key(config)
    assert key1 == key2
    assert key1.startswith("train:")


def test_config_cache_key_ignores_insertion_order():
    config_a = {"learning_rate": 0.001, "batch_size": 64}
    config_b = {"batch_size": 64, "learning_rate": 0.001}
    assert config_cache_key(config_a) == config_cache_key(config_b)


def test_config_cache_key_differs_for_different_configs():
    config_a = {"learning_rate": 0.001, "batch_size": 64}
    config_b = {"learning_rate": 0.01, "batch_size": 64}
    assert config_cache_key(config_a) != config_cache_key(config_b)


# ---------------------------------------------------------------------------
# /cache/stats endpoint
# ---------------------------------------------------------------------------


def test_cache_stats_endpoint(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    reset_cache()  # ensure fresh in-memory cache for this test

    from backend.api.main import app

    with TestClient(app) as client:
        response = client.get("/cache/stats")

    assert response.status_code == 200
    payload = response.json()
    assert "backend" in payload
    assert "hits" in payload
    assert "misses" in payload

    reset_cache()
