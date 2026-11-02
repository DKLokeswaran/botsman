import pytest

from hermes_bots.routine_output import extract_output, format_target, parse_target, routine_message

WRAPPED = (
    "Cronjob Response: Morning briefing\n(job_id: 71db93b696f4)\n-------------\n\n"
    "Line one\n\nLine two\n\n"
    "To stop or manage this job, send me a new message (e.g. \"stop reminder Morning briefing\")."
)


def test_target_round_trips_names_with_commas_slashes_and_unicode():
    name = "News, daily / weekly — ünïcode"
    target = format_target("20261031_212026_cdff05", name)
    assert "," not in target and target.count("/") == 1
    platform, _, chat_id = target.partition(":")
    assert platform == "hbapp"
    assert parse_target(chat_id) == ("20261031_212026_cdff05", name)


def test_target_without_routine_name_gets_the_default_name():
    assert parse_target("session-abc") == ("abc", "Routine")
    assert parse_target("session-abc/") == ("abc", "Routine")


@pytest.mark.parametrize("chat_id", ["", "abc/news", "session-", "session-/news", "chat-abc"])
def test_malformed_targets_are_refused(chat_id):
    with pytest.raises(ValueError):
        parse_target(chat_id)


def test_wrapped_output_loses_header_and_footer():
    assert extract_output(WRAPPED) == ("Line one\n\nLine two", False)


def test_wrapped_output_cut_before_the_footer_keeps_the_rest():
    cut = "Cronjob Response: n\n(job_id: x)\n-------------\n\nbody ... [truncated, full output saved to /tmp/x]"
    assert extract_output(cut) == ("body ... [truncated, full output saved to /tmp/x]", False)


def test_unwrapped_output_is_kept_whole():
    assert extract_output("Reactor check: all green.") == ("Reactor check: all green.", False)


def test_failures_are_recognised_wrapped_and_unwrapped():
    failure = "⚠️ Cron 'Morning briefing' failed: provider error. Check the model."
    assert extract_output(failure) == (failure, True)
    wrapped = WRAPPED.replace("Line one\n\nLine two", failure)
    assert extract_output(wrapped) == (failure, True)


def test_output_that_mentions_a_failure_later_is_not_a_failure():
    assert extract_output("All good.\n⚠️ Cron 'x' failed: last week")[1] is False


def test_routine_message_labels_the_output():
    assert routine_message("Morning briefing", "Hi") == "[Routine: Morning briefing]\nHi"


def test_targets_and_messages_match_the_contract():
    import json
    import re

    from helpers import PLUGIN_DIR
    schema = json.loads((PLUGIN_DIR.parent / "contract" / "hermes-bots-plugin.schema.json").read_text())["$defs"]
    assert re.match(schema["DeliverTarget"]["pattern"], format_target("20261031_212026_cdff05", "News, daily / ü"))
    assert re.match(schema["RoutineMessage"]["pattern"], routine_message("News", "body"))


@pytest.mark.parametrize("notice", [
    "⚠️ Cron 'News' failed: its script timed out. No model was invoked.",
    "⛔ Cron 'News' did not run: no model is configured. Nothing was charged.",
    "⚠ Cron job 'News' was auto-paused\n\nIt failed three times in a row.",
    "⚠ Cron watchdog 'News' script failed\n\nexit status 1",
    "⚠ Cron monitor 'News' source failed\n\nconnection refused",
])
def test_every_cron_failure_notice_is_a_failure(notice):
    assert extract_output(notice) == (notice, True)
