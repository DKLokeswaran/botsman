"""Hermes Bots companion plugin: the ``hbapp`` routine delivery platform and the alert hooks."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult
from gateway.platforms.send_targets import parse_nonempty

from . import alerts, delivery
from .routine_output import PLATFORM

logger = logging.getLogger(__name__)

TEXT_ONLY = "Hermes Bots routines deliver text only; the attachment was not delivered"


class HbappAdapter(BasePlatformAdapter):
    """Delivery-only platform for scheduled runs: queues cron output for a dashboard chat.

    Routines deliver text only. Cron hands each ``MEDIA:`` attachment to a media method after the
    text; those methods report the attachment as not delivered, which Hermes records in the run's
    delivery error, and post nothing to the chat.
    """

    # Cron must hand over the whole output; the chat has no message size limit
    splits_long_messages = True

    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform(PLATFORM))

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        if hasattr(self, "_mark_connected"):
            self._mark_connected()
        return True

    async def disconnect(self) -> None:
        return None

    async def send(self, chat_id, content, reply_to=None, metadata=None) -> SendResult:
        """Scheduled-run path: queue the output for the chat and report it as sent."""
        try:
            row_id = await asyncio.to_thread(delivery.queue_routine_output, chat_id, content)
        except Exception as exc:
            logger.warning("hbapp could not queue output for %r: %s", chat_id, exc)
            return SendResult(success=False, error=str(exc))
        return SendResult(success=True, message_id=f"queued-{row_id}")

    async def get_chat_info(self, chat_id: str) -> dict[str, Any]:
        return {"name": chat_id, "type": "dm"}

    # Attachments: refused without a chat notice, so a routine never posts a second row or alert
    async def send_image(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_image_file(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_multiple_images(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_animation(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_document(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_video(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)

    async def send_voice(self, chat_id, *args, **kwargs) -> SendResult:
        return _attachment_refused(chat_id)


def _attachment_refused(chat_id: str) -> SendResult:
    logger.info("hbapp did not deliver an attachment for %r: routines deliver text only", chat_id)
    return SendResult(success=False, error=TEXT_ONLY)


async def _standalone_send(pconfig, chat_id, message, *, thread_id=None, media_files=None, force_document=False):
    """Run now path: the dashboard runs the job and hands the output here, with no live adapter.

    Only the text is queued; ``media_files`` are not delivered, as on scheduled runs.
    """
    if media_files:
        logger.info("hbapp did not deliver %d attachment(s) for %r: routines deliver text only",
                    len(media_files), chat_id)
    try:
        row_id = await asyncio.to_thread(delivery.queue_routine_output, chat_id, message)
    except Exception as exc:
        logger.warning("hbapp could not queue output for %r: %s", chat_id, exc)
        return {"error": str(exc)}
    return {"success": True, "platform": PLATFORM, "chat_id": chat_id, "message_id": f"queued-{row_id}"}


def register(ctx) -> None:
    """Hermes entry point: add the ``hbapp`` platform and the alert hooks to this profile."""
    # Delivery platform that cron's ``deliver: hbapp:...`` targets
    ctx.register_platform(
        name=PLATFORM, label="Hermes Bots", adapter_factory=HbappAdapter,
        check_fn=lambda: True, is_connected=lambda config: True,
        cron_deliver_env_var="HBAPP_HOME_CHANNEL", target_ref_syntax_fn=parse_nonempty,
        standalone_sender_fn=_standalone_send,
    )
    # Hooks that raise alerts
    for name, hook in alerts.HOOKS.items():
        ctx.register_hook(name, hook)
    # Every process that loads the plugin writes queued rows, including rows a stopped process left behind
    delivery.ensure_worker_running()
