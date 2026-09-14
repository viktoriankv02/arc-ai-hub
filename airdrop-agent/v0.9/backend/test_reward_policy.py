from backend.reward_policy import is_confirmed_reward, is_cost_event, reward_transition_allowed


def test_only_confirmed_positive_reward_allows_terminal_reward_transition():
    assert not reward_transition_allowed([{'event_type': 'PENDING', 'amount': '100'}])
    assert not reward_transition_allowed([{'event_type': 'CONFIRMED', 'amount': '0'}])
    assert reward_transition_allowed([{'event_type': 'CONFIRMED', 'amount': '0.01'}])


def test_event_classification():
    assert is_confirmed_reward({'event_type': 'claimed', 'amount': '10'})
    assert not is_confirmed_reward({'event_type': 'fee', 'amount': '1'})
    assert is_cost_event({'event_type': 'gas', 'amount': '0.002'})
    assert not is_cost_event({'event_type': 'received', 'amount': '10'})
