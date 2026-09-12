from __future__ import annotations

import time
import unittest

from .opportunity_intelligence import research_opportunity


class ResearchIntelligenceTests(unittest.TestCase):
    def base(self) -> dict:
        return {
            'project': 'Example Protocol',
            'official_url': 'https://example.org/quests',
            'source': 'Official',
            'sources': ['Official', 'CryptoRank'],
            'source_confidence': 90,
            'risk_score': 15,
            'chain': 'Base',
            'reward': 'Points',
            'tasks': [{'type': 'CHECK_IN', 'cost': '0'}],
            'last_updated': int(time.time()),
        }

    def test_official_fresh_opportunity_is_high_priority(self):
        result = research_opportunity(self.base())
        self.assertEqual(result['freshness_status'], 'FRESH')
        self.assertEqual(result['review_status'], 'HIGH_PRIORITY')
        self.assertGreaterEqual(result['research_confidence'], 75)

    def test_aggregator_url_is_flagged(self):
        item = self.base()
        item['official_url'] = 'https://cryptorank.io/drophunting'
        result = research_opportunity(item)
        self.assertIn('AGGREGATOR_URL', result['flags'])

    def test_missing_tasks_lowers_confidence(self):
        item = self.base()
        item['tasks'] = []
        result = research_opportunity(item)
        self.assertIn('NO_TASKS', result['flags'])

    def test_spending_requirement_is_not_high_priority(self):
        item = self.base()
        item['tasks'] = [{'type': 'SWAP', 'cost': '2.50'}]
        result = research_opportunity(item)
        self.assertIn('SPEND_REQUIRED', result['flags'])
        self.assertNotEqual(result['review_status'], 'HIGH_PRIORITY')

    def test_unknown_chain_and_reward_are_flagged(self):
        item = self.base()
        item['chain'] = 'Unknown'
        item['reward'] = 'Unknown'
        result = research_opportunity(item)
        self.assertIn('UNKNOWN_CHAIN', result['flags'])
        self.assertIn('UNKNOWN_REWARD', result['flags'])


if __name__ == '__main__':
    unittest.main()
