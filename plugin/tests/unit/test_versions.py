import json
import re

from helpers import PLUGIN_DIR
from hermes_bots.version import VERSION


def test_plugin_yaml_and_dashboard_manifest_repeat_the_version():
    plugin_yaml = (PLUGIN_DIR / "plugin.yaml").read_text()
    assert re.search(r"^version: (\S+)$", plugin_yaml, re.MULTILINE).group(1) == VERSION
    manifest = json.loads((PLUGIN_DIR / "dashboard" / "manifest.json").read_text())
    assert manifest["version"] == VERSION
