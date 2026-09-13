from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from task_state_machine import (
    STATE_FILE,
    EVENT_FILE,
    get_task_state,
    recover_task,
    state_summary,
    transition_task,
)


class TaskStateMachineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state_path = Path(self.tmp.name) / "task_states.json"
        self.event_path = Path(self.tmp.name) / "task_state_events.jsonl"
        self._old_state = STATE_FILE
        self._old_event = EVENT_FILE
        import task_state_machine as module
        module.STATE_FILE = self.state_path
        module.EVENT_FILE = self.event_path

    def tearDown(self):
        import task_state_machine as module
        module.STATE_FILE = self._old_state
        module.EVENT_FILE = self._old_event
        self.tmp.cleanup()

    def test_happy_path(self):
        o, t = "opp-1", "task-1"
        transition_task(o, t, "PREPARED")
        transition_task(o, t, "APPROVED")
        transition_task(o, t, "EXECUTING")
        transition_task(o, t, "PROOF_PENDING")
        transition_task(o, t, "VERIFIED")
        transition_task(o, t, "REWARD_PENDING")
        final = transition_task(o, t, "REWARDED")
        self.assertEqual(final["state"], "REWARDED")
        self.assertEqual(final["attempt"], 1)

    def test_invalid_transition_is_rejected(self):
        with self.assertRaises(ValueError):
            transition_task("opp-1", "task-1", "REWARDED")

    def test_failed_task_becomes_retry_ready(self):
        o, t = "opp-1", "task-1"
        transition_task(o, t, "PREPARED")
        transition_task(o, t, "APPROVED")
        transition_task(o, t, "EXECUTING")
        transition_task(o, t, "FAILED", "temporary browser failure")
        recovered = recover_task(o, t)
        self.assertEqual(recovered["state"], "PREPARED")
        self.assertEqual(recovered["attempt"], 1)

    def test_summary_counts_states(self):
        o, t = "opp-1", "task-1"
        transition_task(o, t, "PREPARED")
        summary = state_summary(o)
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["counts"]["PREPARED"], 1)


if __name__ == "__main__":
    unittest.main()
