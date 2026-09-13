from .task_intelligence import canonical_task_id, enrich_tasks, infer_task_mode, normalize_task_type, task_fingerprint


def test_normalize_common_task_aliases():
    assert normalize_task_type('Daily Check') == 'CHECK_IN'
    assert normalize_task_type('Follow X') == 'FOLLOW_X'
    assert normalize_task_type('Deploy Contract') == 'DEPLOY_CONTRACT'


def test_canonical_task_id_is_stable_for_same_source_id():
    task = {'id': 'quest-42', 'title': 'Bridge ETH'}
    assert canonical_task_id('Demo', task, 0) == canonical_task_id('Demo', task, 9)


def test_mode_respects_security_boundary():
    assert infer_task_mode('PARSE_TASKS') == 'AI_AUTO'
    assert infer_task_mode('FOLLOW_X', 'https://x.com/project') == 'APPROVAL'
    assert infer_task_mode('CAPTCHA') == 'USER_ONLY'


def test_fingerprint_contains_external_id_and_host():
    fp = task_fingerprint('Demo', {'taskId': 'abc', 'title': 'Follow', 'url': 'https://x.com/a'})
    assert fp['source_id'] == 'abc'
    assert fp['host'] == 'x.com'
    assert fp['canonical_id'].startswith('task-')


def test_enrich_tasks_deduplicates_exact_duplicates():
    tasks = [
        {'id': '1', 'title': 'Bridge', 'type': 'BRIDGE', 'url': 'https://example.org'},
        {'id': '1', 'title': 'Bridge', 'type': 'BRIDGE', 'url': 'https://example.org'},
    ]
    result = enrich_tasks('Demo', tasks)
    assert len(result) == 1
