# Monitoring + Scheduler

## Purpose

This layer keeps ARC AI HUB continuously aware of Web3 opportunities without silently executing wallet, social, signing, or financial actions.

## Components

- `monitoring_engine.py` — derives deadline state and monitoring timestamps.
- `scheduler_engine.py` — determines whether a refresh is due; minimum interval is 5 minutes.
- `monitoring_scheduler_service.py` — coordinates refresh + monitoring and keeps the orchestration logic independent from FastAPI.

## Safety boundary

The scheduler may refresh public opportunity data only. It must not:

- sign or broadcast transactions;
- connect a wallet without approval;
- submit authenticated social actions;
- spend funds;
- bypass CAPTCHA or other user-only controls.

Those actions remain behind the existing approval-only task/transaction model.

## Intended API integration

The service is designed to back these API capabilities:

- monitoring status and manual run;
- scheduler status;
- scheduler configuration;
- run-if-due endpoint.

Persistent scheduler state should store `enabled`, `interval_minutes`, `last_run`, `last_count`, `last_ok`, and `last_error`.

## Next production step

Move scheduler persistence and API registration into `main.py`, then expose the same state in the React dashboard. After that, replace JSON persistence with a transactional store and add process-level locking so multiple workers cannot refresh simultaneously.
