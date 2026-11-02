"""What the plugin registers with Hermes: the ``hbapp`` platform and the alert hooks, with Hermes's gateway faked."""

import asyncio
import importlib.util
import sys
import types

import pytest
from helpers import PLUGIN_DIR

HERMES_HOOK_NAMES = {"on_human_input_request", "on_human_input_resolved", "pre_llm_call", "on_session_end"}


class FakeContext:
    """Records what ``register`` hands to Hermes."""

    def __init__(self):
        self.platforms = []
        self.hooks = {}

    def register_platform(self, **kwargs):
        self.platforms.append(kwargs)

    def register_hook(self, name, hook):
        self.hooks[name] = hook


def _fake_gateway(monkeypatch):
    """The gateway names the plugin imports, as stand-ins."""
    class BasePlatformAdapter:
        def __init__(self, config, platform):
            self.config, self.platform = config, platform

    modules = {
        "gateway": {},
        "gateway.config": {"Platform": str, "PlatformConfig": object},
        "gateway.platforms": {},
        "gateway.platforms.base": {"BasePlatformAdapter": BasePlatformAdapter, "SendResult": dict},
        "gateway.platforms.send_targets": {"parse_nonempty": lambda value: value},
    }
    for name, attributes in modules.items():
        module = types.ModuleType(name)
        module.__dict__.update(attributes)
        monkeypatch.setitem(sys.modules, name, module)
    return modules["gateway.platforms.send_targets"]["parse_nonempty"]


@pytest.fixture
def registered(monkeypatch):
    parse_nonempty = _fake_gateway(monkeypatch)
    from hermes_bots import delivery
    worker_starts = []
    monkeypatch.setattr(delivery, "ensure_worker_running", lambda: worker_starts.append(True))
    # Load the package's __init__ as a plain module inside the test package, so its relative imports work
    spec = importlib.util.spec_from_file_location("hermes_bots.entry", PLUGIN_DIR / "__init__.py",
                                                  submodule_search_locations=None)
    plugin = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plugin)
    context = FakeContext()
    plugin.register(context)
    context.worker_starts = worker_starts
    return plugin, context, parse_nonempty


def test_the_hbapp_platform_is_registered_for_cron_delivery(registered):
    plugin, context, parse_nonempty = registered
    [platform] = context.platforms
    assert platform["name"] == "hbapp"
    assert platform["adapter_factory"] is plugin.HbappAdapter
    assert platform["standalone_sender_fn"] is plugin._standalone_send
    assert platform["target_ref_syntax_fn"] is parse_nonempty
    assert platform["cron_deliver_env_var"] == "HBAPP_HOME_CHANNEL"
    assert platform["check_fn"]() is True and platform["is_connected"](None) is True


def test_the_adapter_takes_whole_output(registered):
    plugin, _, _ = registered
    assert plugin.HbappAdapter.splits_long_messages is True


def test_every_alert_hook_is_registered_under_its_hermes_name(registered):
    _, context, _ = registered
    assert set(context.hooks) == HERMES_HOOK_NAMES


def test_loading_the_plugin_starts_the_delivery_worker(registered):
    _, context, _ = registered
    assert context.worker_starts == [True]


@pytest.mark.parametrize("method", ["send_image", "send_image_file", "send_multiple_images", "send_animation",
                                    "send_document", "send_video", "send_voice"])
def test_attachments_are_refused_without_posting_to_the_chat(registered, monkeypatch, method):
    plugin, _, _ = registered
    queued = []
    monkeypatch.setattr(plugin.delivery, "queue_routine_output", lambda *args: queued.append(args) or 1)
    adapter = plugin.HbappAdapter(config=None)
    result = asyncio.run(getattr(adapter, method)("session-s1/News", "/tmp/chart.png"))
    assert result == {"success": False, "error": plugin.TEXT_ONLY}
    assert queued == []


def test_run_now_queues_only_the_text_of_output_with_attachments(registered, monkeypatch):
    plugin, _, _ = registered
    queued = []
    monkeypatch.setattr(plugin.delivery, "queue_routine_output", lambda *args: queued.append(args) or 7)
    result = asyncio.run(plugin._standalone_send(None, "session-s1/News", "Chart attached.",
                                                 media_files=[("/tmp/chart.png", False)]))
    assert result["success"] is True
    assert queued == [("session-s1/News", "Chart attached.")]
