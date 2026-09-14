from .opportunity_sources import _TableParser, normalize_cryptorank, normalize_incrypted


def test_incrypted_table_parser():
    html = '''<table><tr><th>Name</th><th>Status</th><th>Reward</th><th>Activity</th><th>Timeline</th><th>Networks</th><th>Rating</th></tr><tr><td><a href="/ua/airdrops/test/tempo/">Tempo</a></td><td>Актуальні</td><td>Невідомо</td><td>Тестнети</td><td>-</td><td>Tempo</td><td>2</td></tr></table>'''
    parser = _TableParser()
    parser.feed(html)
    item = normalize_incrypted(parser.rows[1], "testnet")
    assert item is not None
    assert item["project"] == "Tempo"
    assert item["category"] == "testnet"
    assert item["source"] == "INCRYPTED"
    assert item["external_url"].startswith("https://incrypted.com/")


def test_cryptorank_normalization():
    item = normalize_cryptorank({
        "id": 42,
        "key": "tempo",
        "status": "CONFIRMED",
        "reward": "Tokens",
        "coin": {"name": "Tempo"},
        "links": {"claim": "https://tempo.xyz/"},
        "tasks": [{"cost": "0", "timeMinutes": "30", "blockchains": [{"name": "Tempo"}]}],
    })
    assert item["id"] == "cryptorank-42"
    assert item["project"] == "Tempo"
    assert item["chain"] == "Tempo"
    assert item["estimated_cost"] == 0
    assert item["tasks"]
