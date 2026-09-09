import asyncio
from datetime import datetime, timezone


class SchedulerService:
    def __init__(self, callback, interval_seconds=900):
        self.callback = callback
        self.interval_seconds = interval_seconds
        self._task = None
        self.last_run_at = None
        self.last_result = {}

    async def run_once(self):
        try:
            self.last_result = await self.callback() or {}
        except Exception as exc:
            self.last_result = {"error": str(exc)}
        self.last_run_at = datetime.now(timezone.utc).isoformat()
        return self.last_result

    async def _loop(self):
        while True:
            await asyncio.sleep(max(60, self.interval_seconds))
            await self.run_once()

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    async def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    def status(self):
        return {
            "running": self._task is not None and not self._task.done(),
            "interval_seconds": self.interval_seconds,
            "last_run_at": self.last_run_at,
            "last_result": self.last_result,
        }
