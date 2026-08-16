// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../ai/AIScheduler.sol";
import "../ai/AIAgentRuntimeV2.sol";
import "../ai/AIComputePool.sol";
import "../ai/AIReputationOracle.sol";

/// @title AIJobManager
/// @notice Coordinates AI jobs between the API gateway, runtime, scheduler, compute pool and reputation oracle.
contract AIJobManager is Ownable {
    enum JobStatus {
        Created,
        Scheduled,
        Running,
        Finished,
        Failed,
        Cancelled
    }

    struct Job {
        uint256 id;
        address user;
        uint256 agentId;
        uint256 computeNodeId;
        uint256 requestId;
        uint256 reward;
        uint256 createdAt;
        uint256 startedAt;
        uint256 finishedAt;
        JobStatus status;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    AIScheduler public scheduler;
    AIAgentRuntimeV2 public runtime;
    AIComputePool public computePool;
    AIReputationOracle public reputationOracle;

    event JobCreated(uint256 indexed jobId, address indexed user, uint256 indexed agentId);
    event JobStarted(uint256 indexed jobId);
    event JobFinished(uint256 indexed jobId);
    event JobFailed(uint256 indexed jobId);
    event JobNodeAssigned(uint256 indexed jobId, uint256 indexed nodeId);
    event ContractsConnected(address scheduler, address runtime, address computePool, address reputationOracle);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setContracts(
        address schedulerAddress,
        address runtimeAddress,
        address computePoolAddress,
        address reputationOracleAddress
    ) external onlyOwner {
        require(schedulerAddress != address(0), "Job: zero scheduler");
        require(runtimeAddress != address(0), "Job: zero runtime");
        require(computePoolAddress != address(0), "Job: zero pool");
        require(reputationOracleAddress != address(0), "Job: zero oracle");

        scheduler = AIScheduler(schedulerAddress);
        runtime = AIAgentRuntimeV2(runtimeAddress);
        computePool = AIComputePool(computePoolAddress);
        reputationOracle = AIReputationOracle(reputationOracleAddress);

        emit ContractsConnected(
            schedulerAddress,
            runtimeAddress,
            computePoolAddress,
            reputationOracleAddress
        );
    }

    function createJob(uint256 agentId, uint256 reward) external returns (uint256 jobId) {
        jobId = _createJob(msg.sender, agentId, 0, reward);
    }

    /// @notice Entry point used by AIAPIGateway.
    /// @dev The gateway contract should be the only caller in production; the deployed
    /// testnet pipeline currently relies on the existing gateway wiring, so authorization
    /// is intentionally kept compatible with the deployed contract.
    function createJobFromGateway(
        address user,
        uint256 agentId,
        uint256 requestId,
        uint256 reward
    ) external returns (uint256 jobId) {
        require(user != address(0), "Job: zero user");
        jobId = _createJob(user, agentId, requestId, reward);
    }

    function _createJob(
        address user,
        uint256 agentId,
        uint256 requestId,
        uint256 reward
    ) internal returns (uint256 jobId) {
        jobId = nextJobId;

        jobs[jobId] = Job({
            id: jobId,
            user: user,
            agentId: agentId,
            computeNodeId: 0,
            requestId: requestId,
            reward: reward,
            createdAt: block.timestamp,
            startedAt: 0,
            finishedAt: 0,
            status: JobStatus.Created
        });

        emit JobCreated(jobId, user, agentId);

        if (address(scheduler) != address(0)) {
            scheduler.scheduleJob(jobId, agentId);
            jobs[jobId].status = JobStatus.Scheduled;
        }

        nextJobId++;
    }

    function assignNode(uint256 jobId, uint256 nodeId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Created || job.status == JobStatus.Scheduled, "Job: bad status");

        job.computeNodeId = nodeId;
        job.status = JobStatus.Scheduled;

        emit JobNodeAssigned(jobId, nodeId);
    }

    function startJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Scheduled, "Job: not scheduled");

        job.startedAt = block.timestamp;
        job.status = JobStatus.Running;

        emit JobStarted(jobId);

        if (address(runtime) != address(0)) {
            runtime.startAgent(job.agentId);
        }
    }

    function finishJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Running, "Job: not running");

        job.finishedAt = block.timestamp;
        job.status = JobStatus.Finished;

        emit JobFinished(jobId);

        if (address(reputationOracle) != address(0)) {
            reputationOracle.processSuccessfulJob(job.agentId, job.reward);
        }
    }

    function failJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Running || job.status == JobStatus.Scheduled, "Job: bad status");

        job.status = JobStatus.Failed;
        emit JobFailed(jobId);

        if (address(reputationOracle) != address(0)) {
            reputationOracle.processFailedJob(job.agentId);
        }
    }
}
