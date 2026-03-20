import json
from types import SimpleNamespace

from scripts import hpo_search


class FakeStudy:
    def __init__(self):
        self.best_trial = SimpleNamespace(
            number=4,
            value=98.91,
            params={"learning_rate": 0.001, "batch_size": 64, "optimizer": "adam"},
        )
        self.trials = [
            SimpleNamespace(number=4, value=98.91, params={"learning_rate": 0.001, "batch_size": 64}),
            SimpleNamespace(number=1, value=98.22, params={"learning_rate": 0.01, "batch_size": 128}),
        ]
        self.optimize_calls = []

    def optimize(self, objective, n_trials, n_jobs, show_progress_bar, gc_after_trial, callbacks=None):
        self.optimize_calls.append({
            "objective": objective,
            "n_trials": n_trials,
            "n_jobs": n_jobs,
            "show_progress_bar": show_progress_bar,
            "gc_after_trial": gc_after_trial,
            "callbacks": callbacks,
        })


def test_run_hpo_uses_parallel_workers_and_persists_metadata(monkeypatch, workspace_tmp_path):
    fake_study = FakeStudy()
    monkeypatch.chdir(workspace_tmp_path)
    fake_asset = SimpleNamespace(dataset="dataset", dataset_name="tiny_dataset.csv", dataset_kind="tabular")
    monkeypatch.setattr(hpo_search, "load_training_asset", lambda dataset_name=None: fake_asset)
    monkeypatch.setattr(hpo_search, "make_objective", lambda asset, experiment_name: "objective")
    monkeypatch.setattr(hpo_search.optuna, "create_study", lambda **kwargs: fake_study)

    output_path = workspace_tmp_path / "results" / "best_hpo_config.json"
    result = hpo_search.run_hpo(
        n_trials=6,
        n_jobs=3,
        experiment_name="parallel-hpo-test",
        output_path=str(output_path),
        dataset_name="tiny_dataset.csv",
    )

    assert len(fake_study.optimize_calls) == 1
    optimize_call = fake_study.optimize_calls[0]
    assert optimize_call["objective"] == "objective"
    assert optimize_call["n_trials"] == 6
    assert optimize_call["n_jobs"] == 3
    assert optimize_call["show_progress_bar"] is False
    assert optimize_call["gc_after_trial"] is True
    assert len(optimize_call["callbacks"]) == 1
    assert callable(optimize_call["callbacks"][0])
    assert result["best_trial"] == 4
    assert result["n_jobs"] == 3
    assert result["execution_mode"] == "parallel"
    assert result["dataset_name"] == "tiny_dataset.csv"

    saved = json.loads(output_path.read_text(encoding="utf-8"))
    assert saved["n_jobs"] == 3
    assert saved["execution_mode"] == "parallel"
    assert saved["dataset_name"] == "tiny_dataset.csv"
