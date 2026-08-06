// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AIAgentEngine is Ownable {

    address public registry;

    address public runtime;

    address public wallet;

    address public marketplace;

    address public computePool;

    address public orchestrator;

    IERC20 public rewardToken;

    constructor(

        address owner,

        address token

    )

        Ownable(owner)

    {

        rewardToken = IERC20(token);

    }

    event RegistryUpdated(address registry);

    event RuntimeUpdated(address runtime);

    event WalletUpdated(address wallet);

    event MarketplaceUpdated(address marketplace);

    event ComputePoolUpdated(address computePool);

    event OrchestratorUpdated(address orchestrator);

    function setRegistry(address _registry)
        external
        onlyOwner
    {
        registry = _registry;

        emit RegistryUpdated(_registry);
    }

    function setRuntime(address _runtime)
        external
        onlyOwner
    {
        runtime = _runtime;

        emit RuntimeUpdated(_runtime);
    }

    function setWallet(address _wallet)
        external
        onlyOwner
    {
        wallet = _wallet;

        emit WalletUpdated(_wallet);
    }

    function setMarketplace(address _marketplace)
        external
        onlyOwner
    {
        marketplace = _marketplace;

        emit MarketplaceUpdated(_marketplace);
    }

    function setComputePool(address _pool)
        external
        onlyOwner
    {
        computePool = _pool;

        emit ComputePoolUpdated(_pool);
    }

    function setOrchestrator(address _orchestrator)
        external
        onlyOwner
    {
        orchestrator = _orchestrator;

        emit OrchestratorUpdated(_orchestrator);
    }

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

    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        uint256 reward
    );

    event JobAssigned(
        uint256 indexed jobId,
        uint256 indexed agentId
    );

    event JobCompleted(
        uint256 indexed jobId
    );

    function createJob(

        uint256 agentId,

        string calldata task,

        uint256 reward

    )

        external

    {

        require(reward > 0, "Reward is zero");

        rewardToken.transferFrom(

            msg.sender,

            address(this),

            reward

        );

        jobs[nextJobId] = AIJob({

            id: nextJobId,

            creator: msg.sender,

            agentId: agentId,

            task: task,

            reward: reward,

            assigned: false,

            completed: false,

            createdAt: block.timestamp,

            completedAt: 0

        });

        emit JobCreated(

            nextJobId,

            msg.sender,

            reward

        );

        nextJobId++;
    }

    function assignJob(

        uint256 jobId

    )

        external

        onlyOwner

    {

        AIJob storage job = jobs[jobId];

        require(!job.assigned, "Already assigned");

        require(!job.completed, "Already completed");

        job.assigned = true;

        emit JobAssigned(

            jobId,

            job.agentId

        );

    }

    function completeJob(

        uint256 jobId

    )

        external

        onlyOwner

    {

        AIJob storage job = jobs[jobId];

        require(job.assigned, "Not assigned");

        require(!job.completed, "Already completed");

        job.completed = true;

        job.completedAt = block.timestamp;

        emit JobCompleted(jobId);

    }

    function payReward(

        uint256 jobId,

        address receiver

    )

        external

        onlyOwner

    {

        AIJob storage job = jobs[jobId];

        require(job.completed, "Job not completed");

        require(job.reward > 0, "No reward");

        uint256 amount = job.reward;

        job.reward = 0;

        rewardToken.transfer(

            receiver,

            amount

        );

    }

}