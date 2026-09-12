from __future__ import annotations

import unittest

from .browser_actions import build_browser_execution_plan, safe_url
from .execution_engine import build_execution_plan
from .drop_hunter import opportunity_score


class DropHunterCoreTests(unittest.TestCase):
    def test_score_is_bounded(self):
        self.assertGreaterEqual(opportunity_score(30, 90, 20, 0, 10, 10), 0)
        self.assertLessEqual(opportunity_score(30, 90, 20, 0, 10, 10), 100)

    def test_execution_plan_separates_auto_and_approval(self):
        opportunity = {
            "id": "t1",
            "project": "Demo",
            "tasks": [
                {"id": "a", "title": "Parse", "type": "PARSE_TASKS", "approval_required": False},
                {"id": "b", "title": "Check-in", "type": "CHECK_IN", "approval_required": True},
                {"id": "c", "title": "Captcha", "type": "CAPTCHA", "approval_required": True},
            ],
        }
        plan = build_execution_plan(opportunity)
        self.assertEqual(plan["summary"]["ai_auto"], 1)
        self.assertEqual(plan["summary"]["approval"], 1)
        self.assertEqual(plan["summary"]["user_only"], 1)

    def test_browser_plan_is_plan_only(self):
        opportunity = {
            "id": "t2",
            "project": "Demo",
            "official_url": "https://example.com",
            "tasks": [
                {"id": "a", "title": "Follow", "type": "FOLLOW_X", "url": "https://x.com/example"},
            ],
        }
        plan = build_browser_execution_plan(opportunity)
        self.assertEqual(plan["status"], "PLAN_ONLY")
        self.assertTrue(plan["steps"][0]["approval_required"])
        self.assertEqual(plan["steps"][0]["action"], "open_and_pause")

    def test_safe_url_rejects_non_http(self):
        self.assertFalse(safe_url("javascript:alert(1)")["valid"])
        self.assertTrue(safe_url("https://example.com/path")["valid"])


if __name__ == "__main__":
    unittest.main()
