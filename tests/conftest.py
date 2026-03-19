import uuid
from pathlib import Path

import pytest


@pytest.fixture
def workspace_tmp_path():
    base_dir = Path.cwd() / ".test-workspaces"
    base_dir.mkdir(exist_ok=True)

    workspace = base_dir / f"workspace-{uuid.uuid4().hex}"
    workspace.mkdir()
    yield workspace
