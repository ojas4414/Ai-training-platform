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

    def optimize(self, objective, n_trials, n_jobs, show_progress_bar, gc_after_trial):
        self.optimize_calls.append({
            "objective": objective,
            "n_trials": n_trials,
            "n_jobs": n_jobs,
            "show_progress_bar": show_progress_bar,
            "gc_after_trial": gc_after_trial,
        })


def test_run_hpo_uses_parallel_workers_and_persists_metadata(monkeypatch, workspace_tmp_path):
    fake_study = FakeStudy()
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setattr(hpo_search, "load_dataset", lambda: "dataset")
    monkeypatch.setattr(hpo_search, "make_objective", lambda dataset, experiment_name: "objective")
    monkeypatch.setattr(hpo_search.optuna, "create_study", lambda **kwargs: fake_study)

    output_path = workspace_tmp_path / "results" / "best_hpo_config.json"
    result = hpo_search.run_hpo(
        n_trials=6,
        n_jobs=3,
        experiment_name="parallel-hpo-test",
        output_path=str(output_path),
    )

    assert fake_study.optimize_calls == [{
        "objective": "objective",
        "n_trials": 6,
        "n_jobs": 3,
        "show_progress_bar": False,
        "gc_after_trial": True,
    }]
    assert result["best_trial"] == 4
    assert result["n_jobs"] == 3
    assert result["execution_mode"] == "parallel"

    saved = json.loads(output_path.read_text(encoding="utf-8"))
    assert saved["n_jobs"] == 3
    assert saved["execution_mode"] == "parallel"
