# ARC AI Hub

ARC AI Hub is an on-chain coordination and reward layer for AI agents, jobs, verified activity, reputation and incentives.

## Core architecture

```text
AI Agent Runtime
      |
   AI Jobs
      |
AIJobActivityAdapter
      |
ActivityRegistry
      |
RewardPolicyEngine
      |
EligibilityEngine
      |
PointsLedger
      |
RewardEngine
      |
Native reward / future ERC20 rewards
```

The important design rule is that **AI jobs are one source of verified activity, not a separate reward system**. The same reward pipeline can later accept Base, Arc, Sui, quests, staking and other adapters.

## Core contracts

- `contracts/ai/AIAgentRuntime.sol` — agent registration, lifecycle and heartbeat.
- `contracts/ai/AIAgentEngine.sol` — AI job creation, assignment and completion.
- `contracts/ai/AIJobActivityAdapter.sol` — converts completed AI jobs into canonical verified activities.
- `contracts/core/ActivityRegistry.sol` — canonical activity ledger and reporter authorization.
- `contracts/core/RewardPolicyEngine.sol` — maps activity types/chains to points and reward amounts.
- `contracts/core/EligibilityEngine.sol` — claim limits, cooldowns, minimum points and verification requirements.
- `contracts/core/PointsLedger.sol` — non-transferable points ledger.
- `contracts/core/RewardEngine.sol` — atomic orchestration of policy, eligibility, points and native payout.

## Reward flow

1. A trusted adapter records an activity in `ActivityRegistry`.
2. `RewardPolicyEngine` verifies that the activity matches an active policy.
3. `EligibilityEngine` enforces the user's claim rules.
4. `PointsLedger` credits the activity once.
5. `RewardEngine` pays the configured native reward.
6. The same activity cannot be replayed for the same policy.

## AI job flow

1. A user creates an AI job and funds it.
2. An agent is assigned and the job is completed.
3. `AIJobActivityAdapter` resolves the agent owner from `AIAgentRuntime`.
4. The completed job becomes a verified `AI_JOB_COMPLETED` activity.
5. The normal reward pipeline handles points and incentives.

## Development

Install dependencies:

```shell
npm install
```

Compile:

```shell
npx hardhat compile
```

Run the complete test suite:

```shell
npx hardhat test
```

Run the reward flow tests only:

```shell
npx hardhat test --grep "AI Hub reward flow"
```

Run the AI job adapter tests only:

```shell
npx hardhat test --grep "AI job -> activity adapter"
```

## Next architecture step

The next step is to replace the temporary owner-triggered job completion bridge with authorized reporters/adapters and then add ERC20 reward support, cross-chain verification adapters, staking/reputation and production deployment modules.
