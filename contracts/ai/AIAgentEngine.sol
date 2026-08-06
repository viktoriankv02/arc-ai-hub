// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AIAgentEngine
/// @notice Creates, assigns and settles AI jobs. Completion can be reported by authorized orchestrators.
contract AIAgentEngine is Ownable {
    using SafeERC20 for IERC20;

    address public registry;
    address public runtime;
    address public wallet;
    address public marketplace;
    address public computePool;
    address public orchestrator;
    IERC20 public rewardToken;

    struct AIJob {
        uint256 id;
        address creator;
        uint256 agentId;
        string task;
        uint256 reward;
        bool assigned;
        bool completed;
        uint256 createdAt;
        uint256 completedAt;
    }

    uint256 public nextJobId;
    mapping(uint256 => AIJob) public jobs;
    mapping(address => bool) public completionReporters;

    event RegistryUpdated(address registry);
    event RuntimeUpdated(address runtime);
    event WalletUpdated(address wallet);
    event MarketplaceUpdated(address marketplace);
    event ComputePoolUpdated(address computePool);
    event OrchestratorUpdated(address orchestrator);
    event CompletionReporterUpdated(address indexed reporter, bool enabled);
    event JobCreated(uint256 indexed jobId, address indexed creator, uint256 reward);
    event JobAssigned(uint256 indexed jobId, uint256 indexed agentId);
    event JobCompleted(uint256 indexed jobId, address indexed reporter);
    event RewardPaid(uint256 indexed jobId, address indexed receiver, uint256 amount);

    error UnauthorizedReporter();

    constructor(address owner, address token) Ownable(owner) {
        require(token != address(0), "Agent: zero token");
        rewardToken = IERC20(token);
    }

    modifier onlyCompletionReporter() {
        if (!completionReporters[msg.sender]) revert UnauthorizedReporter();
        _;
    }

    function setRegistry(address value) external onlyOwner { registry = value; emit RegistryUpdated(value); }
    function setRuntime(address value) external onlyOwner { runtime = value; emit RuntimeUpdated(value); }
    function setWallet(address value) external onlyOwner { wallet = value; emit WalletUpdated(value); }
    function setMarketplace(address value) external onlyOwner { marketplace = value; emit MarketplaceUpdated(value); }
    function setComputePool(address value) external onlyOwner { computePool = value; emit ComputePoolUpdated(value); }
    function setOrchestrator(address value) external onlyOwner { orchestrator = value; emit OrchestratorUpdated(value); }

    function setCompletionReporter(address reporter, bool enabled) external onlyOwner {
        require(reporter != address(0), "Agent: zero reporter");
        completionReporters[reporter] = enabled;
        emit CompletionReporterUpdated(reporter, enabled);
    }

    function createJob(uint256 agentId, string calldata task, uint256 reward) external {
        require(reward > 0, "Reward is zero");
        rewardToken.safeTransferFrom(msg.sender, address(this), reward);
        jobs[nextJobId] = AIJob(nextJobId, msg.sender, agentId, task, reward, false, false, block.timestamp, 0);
        emit JobCreated(nextJobId, msg.sender, reward);
        nextJobId++;
    }

    function assignJob(uint256 jobId) external onlyOwner {
        AIJob storage job = jobs[jobId];
        require(!job.assigned, "Already assigned");
        require(!job.completed, "Already completed");
        job.assigned = true;
        emit JobAssigned(jobId, job.agentId);
    }

    function completeJob(uint256 jobId) external onlyCompletionReporter {
        AIJob storage job = jobs[jobId];
        require(job.assigned, "Not assigned");
        require(!job.completed, "Already completed");
        job.completed = true;
        job.completedAt = block.timestamp;
        emit JobCompleted(jobId, msg.sender);
    }

    function payReward(uint256 jobId, address receiver) external onlyOwner {
        AIJob storage job = jobs[jobId];
        require(job.completed, "Job not completed");
        require(job.reward > 0, "No reward");
        uint256 amount = job.reward;
        job.reward = 0;
        rewardToken.safeTransfer(receiver, amount);
        emit RewardPaid(jobId, receiver, amount);
    }
}
