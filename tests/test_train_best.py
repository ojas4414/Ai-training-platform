import json

import yaml

from scripts import train_best


def _write_default_config(path, learning_rate=0.005, batch_size=32, epochs=7, optimizer="sgd"):
    path.write_text(
        yaml.safe_dump(
            {
                "learning_rate": learning_rate,
                "batch_size": batch_size,
                "epochs": epochs,
                "optimizer": optimizer,
                "mlflow_experiment": "ai-training-platform",
            }
        ),
        encoding="utf-8",
    )


def test_load_best_config_falls_back_to_default(monkeypatch, workspace_tmp_path):
    default_config_path = workspace_tmp_path / "train_config.yaml"
    best_config_path = workspace_tmp_path / "best_config.json"
    results_path = workspace_tmp_path / "results.json"
    _write_default_config(default_config_path)

    monkeypatch.setattr(train_best, "DEFAULT_CONFIG_PATH", default_config_path)
    monkeypatch.setattr(train_best, "BEST_CONFIG_PATH", best_config_path)
    monkeypatch.setattr(train_best, "RESULTS_PATH", results_path)

    config, source = train_best.load_best_config()

    assert source == str(default_config_path)
    assert config["learning_rate"] == 0.005
    assert config["batch_size"] == 32
    assert config["epochs"] == 7
    assert config["optimizer"] == "sgd"


def test_load_best_config_prefers_explicit_best_config(monkeypatch, workspace_tmp_path):
    default_config_path = workspace_tmp_path / "train_config.yaml"
    best_config_path = workspace_tmp_path / "best_config.json"
    results_path = workspace_tmp_path / "results.json"
    _write_default_config(default_config_path)

    best_config_path.write_text(
        json.dumps(
            {
                "learning_rate": 0.002,
                "batch_size": 128,
                "epochs": 9,
                "optimizer": "adam",
            }
        ),
        encoding="utf-8",
    )
    results_path.write_text(
        json.dumps(
            [
                {
                    "learning_rate": 0.001,
                    "batch_size": 64,
                    "epochs": 5,
                    "best_accuracy": 99.0,
                }
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(train_best, "DEFAULT_CONFIG_PATH", default_config_path)
    monkeypatch.setattr(train_best, "BEST_CONFIG_PATH", best_config_path)
    monkeypatch.setattr(train_best, "RESULTS_PATH", results_path)

    config, source = train_best.load_best_config()

    assert source == str(best_config_path)
    assert config["learning_rate"] == 0.002
    assert config["batch_size"] == 128
    assert config["epochs"] == 9
    assert config["optimizer"] == "adam"


def test_load_best_config_uses_best_manual_result(monkeypatch, workspace_tmp_path):
    default_config_path = workspace_tmp_path / "train_config.yaml"
    best_config_path = workspace_tmp_path / "best_config.json"
    results_path = workspace_tmp_path / "results.json"
    _write_default_config(default_config_path)

    results_path.write_text(
        json.dumps(
            [
                {
                    "learning_rate": 0.1,
                    "batch_size": 64,
                    "epochs": 5,
                    "best_accuracy": 76.77,
                },
                {
                    "learning_rate": 0.001,
                    "batch_size": 64,
                    "epochs": 5,
                    "best_accuracy": 98.18,
                },
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(train_best, "DEFAULT_CONFIG_PATH", default_config_path)
    monkeypatch.setattr(train_best, "BEST_CONFIG_PATH", best_config_path)
    monkeypatch.setattr(train_best, "RESULTS_PATH", results_path)

    config, source = train_best.load_best_config()

    assert "best_accuracy=98.18" in source
    assert config["learning_rate"] == 0.001
    assert config["batch_size"] == 64
    assert config["epochs"] == 5
    assert config["optimizer"] == "sgd"
