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


class HbappAdapter(BasePlatformAdapter):
    """Delivery-only platform for scheduled runs: queues cron output for a dashboard chat."""

    # Cron must hand over the whole output; the chat has no message size limit
    splits_long_messages = True

    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform(PLATFORM))

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        # The gateway is long-lived, so its worker also writes rows a stopped process left queued
        delivery.ensure_worker_running()
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


async def _standalone_send(pconfig, chat_id, message, *, thread_id=None, media_files=None, force_document=False):
    """Run now path: the dashboard runs the job and hands the output here, with no live adapter."""
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
