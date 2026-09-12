from __future__ import annotations

import unittest

from .browser_executor import classify_action, execute_dry_run
from .drop_hunter import opportunity_score


class DropHunterCoreTests(unittest.TestCase):
    def test_score_is_bounded(self) -> None:
        self.assertGreaterEqual(opportunity_score(30, 100, 20, 0, 1, 0), 0)
        self.assertLessEqual(opportunity_score(30, 100, 20, 0, 1, 0), 100)

    def test_authenticated_actions_require_approval(self) -> None:
        task = {"id": "x", "type": "CHECK_IN", "url": "https://example.com"}
        self.assertEqual(classify_action(task), "APPROVAL")
        result = execute_dry_run(task)
        self.assertEqual(result["status"], "AWAITING_APPROVAL")
        self.assertFalse(result["performed"])

    def test_public_parse_can_be_auto_classified(self) -> None:
        task = {"id": "x", "type": "PARSE_TASKS", "url": "https://example.com"}
        self.assertEqual(classify_action(task), "AI_AUTO")
        result = execute_dry_run(task)
        self.assertEqual(result["status"], "SIMULATED")
        self.assertFalse(result["performed"])

    def test_invalid_target_is_blocked(self) -> None:
        task = {"id": "x", "type": "CHECK_IN", "url": "javascript:alert(1)"}
        result = execute_dry_run(task)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertFalse(result["performed"])


if __name__ == "__main__":
    unittest.main()
