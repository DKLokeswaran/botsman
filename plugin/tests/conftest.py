"""Makes the plugin's modules importable as ``hermes_bots.<module>`` without Hermes installed.

The package's ``__init__`` imports Hermes's gateway, so the unit tests register an empty package
object for the plugin directory and import the submodules from it.
"""

import sys
import types
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent.parent / "hermes-bots"

if "hermes_bots" not in sys.modules:
    package = types.ModuleType("hermes_bots")
    package.__path__ = [str(PLUGIN_DIR)]
    sys.modules["hermes_bots"] = package
