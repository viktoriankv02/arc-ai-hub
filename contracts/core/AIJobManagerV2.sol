// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../ai/AIScheduler.sol";
import "../ai/AIAgentRuntimeV2.sol";
import "../ai/AIComputePoolV2.sol";
import "../ai/AIReputationOracleV2.sol";

/// @title AIJobManagerV2
/// @notice Secure orchestration pipeline with reward escrow and controller-based settlement.
contract AIJobManagerV2 is Ownable {
    using SafeERC20 for IERC20;

    enum JobStatus { Created, Scheduled, Running, Finished, Failed, Cancelled }

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

    IERC20 public immutable rewardToken;
    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    address public gateway;
    AIScheduler public scheduler;
    AIAgentRuntimeV2 public runtime;
    AIComputePoolV2 public computePool;
    AIReputationOracleV2 public reputationOracle;

    event GatewayUpdated(address indexed gateway);
    event ContractsConnected(address scheduler, address runtime, address computePool, address reputationOracle);
    event JobCreated(uint256 indexed jobId, address indexed user, uint256 indexed agentId, uint256 reward);
    event JobNodeAssigned(uint256 indexed jobId, uint256 indexed nodeId);
    event JobStarted(uint256 indexed jobId);
    event JobFinished(uint256 indexed jobId, uint256 indexed nodeId, uint256 reward);
    event JobFailed(uint256 indexed jobId, uint256 indexed nodeId);

    error NotGateway();

    constructor(address initialOwner, address token) Ownable(initialOwner) {
        require(token != address(0), "Job: zero token");
        rewardToken = IERC20(token);
    }

    function setGateway(address gatewayAddress) external onlyOwner {
        require(gatewayAddress != address(0), "Job: zero gateway");
        gateway = gatewayAddress;
        emit GatewayUpdated(gatewayAddress);
    }

    function setContracts(address schedulerAddress, address runtimeAddress, address poolAddress, address oracleAddress) external onlyOwner {
        require(schedulerAddress != address(0) && runtimeAddress != address(0) && poolAddress != address(0) && oracleAddress != address(0), "Job: zero address");
        scheduler = AIScheduler(schedulerAddress);
        runtime = AIAgentRuntimeV2(runtimeAddress);
        computePool = AIComputePoolV2(poolAddress);
        reputationOracle = AIReputationOracleV2(oracleAddress);
        emit ContractsConnected(schedulerAddress, runtimeAddress, poolAddress, oracleAddress);
    }

    function createJob(uint256 agentId, uint256 reward) external returns (uint256 jobId) {
        return _createJob(msg.sender, agentId, 0, reward);
    }

    function createJobFromGateway(address user, uint256 agentId, uint256 requestId, uint256 reward) external returns (uint256 jobId) {
        if (msg.sender != gateway) revert NotGateway();
        require(user != address(0), "Job: zero user");
        return _createJob(user, agentId, requestId, reward);
    }

    function _createJob(address user, uint256 agentId, uint256 requestId, uint256 reward) internal returns (uint256 jobId) {
        require(reward > 0, "Job: zero reward");
        rewardToken.safeTransferFrom(user, address(this), reward);
        jobId = nextJobId++;
        jobs[jobId] = Job(jobId, user, agentId, type(uint256).max, requestId, reward, block.timestamp, 0, 0, JobStatus.Created);
        emit JobCreated(jobId, user, agentId, reward);
        if (address(scheduler) != address(0)) {
            scheduler.scheduleJob(jobId, agentId);
            jobs[jobId].status = JobStatus.Scheduled;
        }
    }

    function assignNode(uint256 jobId, uint256 nodeId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Created || job.status == JobStatus.Scheduled, "Job: bad status");
        computePool.getNode(nodeId);
        job.computeNodeId = nodeId;
        job.status = JobStatus.Scheduled;
        emit JobNodeAssigned(jobId, nodeId);
    }

    function startJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Scheduled, "Job: not scheduled");
        require(job.computeNodeId != type(uint256).max, "Job: node missing");
        job.startedAt = block.timestamp;
        job.status = JobStatus.Running;
        runtime.startAgent(job.agentId);
        computePool.startJob(jobId, job.computeNodeId);
        emit JobStarted(jobId);
    }

    function finishJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Running, "Job: not running");
        uint256 reward = job.reward;
        job.finishedAt = block.timestamp;
        job.status = JobStatus.Finished;
        job.reward = 0;
        computePool.finishJob(jobId, job.computeNodeId, reward);
        reputationOracle.processSuccessfulJob(job.agentId, reward);
        emit JobFinished(jobId, job.computeNodeId, reward);
    }

    function failJob(uint256 jobId) external onlyOwner {
        Job storage job = jobs[jobId];
        require(job.createdAt != 0, "Job: not found");
        require(job.status == JobStatus.Running || job.status == JobStatus.Scheduled, "Job: bad status");
        bool wasRunning = job.status == JobStatus.Running;
        uint256 refund = job.reward;
        job.status = JobStatus.Failed;
        job.reward = 0;
        if (wasRunning) computePool.failJob(jobId, job.computeNodeId);
        if (refund > 0) rewardToken.safeTransfer(job.user, refund);
        reputationOracle.processFailedJob(job.agentId);
        emit JobFailed(jobId, job.computeNodeId);
    }
}
