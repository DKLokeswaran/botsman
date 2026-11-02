"""Install the working-tree plugin into profiles of a Hermes test instance through ``plugins.manage``.

usage: install_plugin.py SNAPSHOT_REPO PROFILE [PROFILE ...]

The working tree is copied into SNAPSHOT_REPO (a scratch Git repo outside this repository) under
``plugin/hermes-bots`` and committed there, so the install takes the same ``<git url>#<subdir>``
identifier and 40-character ``ref`` the apps use. Restart the gateway and the dashboard afterwards.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path

from hermes_client import Rpc, login

PLUGIN_DIR = Path(__file__).resolve().parents[2] / "hermes-bots"
SUBDIR = "plugin/hermes-bots"
GIT_IDENTITY = ["-c", "user.name=hermes-bots-tests", "-c", "user.email=tests@hermes-bots.invalid"]


def snapshot(repo: Path) -> str:
    """Copy the plugin into the scratch repo, commit it and return the commit SHA."""
    if not (repo / ".git").exists():
        repo.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
    target = repo / SUBDIR
    shutil.rmtree(target, ignore_errors=True)
    shutil.copytree(PLUGIN_DIR, target, ignore=shutil.ignore_patterns("__pycache__"))
    subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(repo), *GIT_IDENTITY, "commit", "-q", "--allow-empty", "-m", "snapshot"], check=True)
    return subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True,
                          text=True).stdout.strip()


async def install(repo: Path, sha: str, profiles: list[str]) -> None:
    """Install into each profile as the apps do: without ``force`` the first time, with it to update."""
    async with Rpc(login()) as rpc:
        for profile in profiles:
            request = {"action": "install", "identifier": f"file://{repo}#{SUBDIR}", "ref": sha,
                       "enable": True, "profile": profile}
            if await _has_plugin(rpc, profile):
                request["force"] = True
            result = await rpc.call("plugins.manage", request, timeout=300)
            print(profile, json.dumps(result)[:600])


async def _has_plugin(rpc: Rpc, profile: str) -> bool:
    listing = await rpc.call("plugins.manage", {"action": "list", "profile": profile})
    return any(plugin["name"] == "hermes-bots" for plugin in listing["plugins"])


if __name__ == "__main__":
    scratch_repo = Path(sys.argv[1]).resolve()
    commit = snapshot(scratch_repo)
    print("snapshot", commit)
    asyncio.run(install(scratch_repo, commit, sys.argv[2:]))
