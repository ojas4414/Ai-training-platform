from __future__ import annotations

import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from threading import Lock
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class JobRecord:
    job_id: str
    kind: str
    status: str = "queued"
    message: str = "Queued"
    progress: float | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    started_at: float | None = None
    completed_at: float | None = None
    error: str | None = None
    result: dict[str, Any] | None = None


class JobNotFoundError(KeyError):
    pass


class JobContext:
    def __init__(self, manager: "JobManager", job_id: str):
        self._manager = manager
        self.job_id = job_id

    def set_running(self, message: str = "Running") -> None:
        self._manager.update(self.job_id, status="running", message=message)

    def set_progress(self, progress: float | None = None, message: str | None = None) -> None:
        self._manager.update(self.job_id, progress=progress, message=message)

    def set_message(self, message: str) -> None:
        self._manager.update(self.job_id, message=message)


class JobManager:
    def __init__(self, max_workers: int = 2):
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="api-job")
        self._jobs: dict[str, JobRecord] = {}
        self._lock = Lock()

    def enqueue(
        self,
        kind: str,
        task: Callable[[JobContext], dict[str, Any]],
        *,
        queued_message: str,
        running_message: str,
    ) -> dict[str, Any]:
        record = JobRecord(
            job_id=uuid.uuid4().hex,
            kind=kind,
            status="queued",
            message=queued_message,
        )
        with self._lock:
            self._jobs[record.job_id] = record

        self._executor.submit(self._run_task, record.job_id, task, running_message)
        return asdict(record)

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                raise JobNotFoundError(job_id)
            return asdict(record)

    def update(
        self,
        job_id: str,
        *,
        status: str | None = None,
        message: str | None = None,
        progress: float | None = None,
        started_at: float | None = None,
        completed_at: float | None = None,
        error: str | None = None,
        result: dict[str, Any] | None = None,
    ) -> None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                raise JobNotFoundError(job_id)

            if status is not None:
                record.status = status
            if message is not None:
                record.message = message
            if progress is not None:
                record.progress = progress
            if started_at is not None:
                record.started_at = started_at
            if completed_at is not None:
                record.completed_at = completed_at
            if error is not None:
                record.error = error
            if result is not None:
                record.result = result

            record.updated_at = time.time()

    def shutdown(self, wait: bool = True) -> None:
        self._executor.shutdown(wait=wait)

    def _run_task(
        self,
        job_id: str,
        task: Callable[[JobContext], dict[str, Any]],
        running_message: str,
    ) -> None:
        started_at = time.time()
        self.update(
            job_id,
            status="running",
            message=running_message,
            started_at=started_at,
            progress=0.0,
        )
        context = JobContext(self, job_id)

        try:
            result = task(context)
        except Exception as exc:
            logger.exception("Background job %s (%s) failed", job_id, running_message)
            self.update(
                job_id,
                status="failed",
                message=f"Job failed: {exc}",
                completed_at=time.time(),
                error=str(exc),
            )
            return

        self.update(
            job_id,
            status="completed",
            message="Job completed",
            progress=100.0,
            completed_at=time.time(),
            result=result,
        )
