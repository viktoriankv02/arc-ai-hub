// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../ai/AIScheduler.sol";
import "../ai/AIAgentRuntime.sol";
import "../ai/AIComputePool.sol";
import "../ai/AIReputationOracle.sol";

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

    AIAgentRuntime public runtime;

    AIComputePool public computePool;

    AIReputationOracle public reputationOracle;

    event JobCreated(

        uint256 indexed jobId,

        address indexed user,

        uint256 agentId

    );

    event JobStarted(

        uint256 indexed jobId

    );

    event JobFinished(

        uint256 indexed jobId

    );

    event JobFailed(

        uint256 indexed jobId

    );

    event ContractsConnected(

        address scheduler,

        address runtime,

        address computePool,

        address reputationOracle

    );

    constructor(

        address owner

    )

        Ownable(owner)

    {}

    function setContracts(

        address schedulerAddress,

        address runtimeAddress,

        address computePoolAddress,

        address reputationOracleAddress

    )

        external

        onlyOwner

    {

        scheduler = AIScheduler(schedulerAddress);

        runtime = AIAgentRuntime(runtimeAddress);

        computePool = AIComputePool(computePoolAddress);

        reputationOracle = AIReputationOracle(reputationOracleAddress);

        emit ContractsConnected(

            schedulerAddress,

            runtimeAddress,

            computePoolAddress,

            reputationOracleAddress

        );

    }

    function createJob(

        uint256 agentId,

        uint256 reward

    )

        external

        returns(uint256)

    {

        jobs[nextJobId] = Job({

            id: nextJobId,

            user: msg.sender,

            agentId: agentId,

            computeNodeId: 0,

            requestId: 0,

            reward: reward,

            createdAt: block.timestamp,

            startedAt: 0,

            finishedAt: 0,

            status: JobStatus.Created

        });

        emit JobCreated(

            nextJobId,

            msg.sender,

            agentId

        );

        // if (address(scheduler) != address(0)) {

        //     scheduler.scheduleJob(

        //         nextJobId,

        //         agentId

        //     );

        // }

        nextJobId++;

        return nextJobId - 1;

    }

    function assignNode(

        uint256 jobId,

        uint256 nodeId

    )

        external

        onlyOwner

    {

        jobs[jobId].computeNodeId = nodeId;

        jobs[jobId].status = JobStatus.Scheduled;

    }

    function startJob(

        uint256 jobId

    )

        external

        onlyOwner

    {

        jobs[jobId].startedAt = block.timestamp;

        jobs[jobId].status = JobStatus.Running;

        emit JobStarted(jobId);

        if (address(runtime) != address(0)) {

            runtime.startAgent(

                jobs[jobId].agentId

            );

        }

    }

    function finishJob(

        uint256 jobId

    )

        external

        onlyOwner

    {

        jobs[jobId].finishedAt = block.timestamp;

        jobs[jobId].status = JobStatus.Finished;

        emit JobFinished(jobId);

        if(address(reputationOracle)!=address(0)){

            reputationOracle.processSuccessfulJob(

                jobs[jobId].agentId,

                jobs[jobId].reward

            );

        }

    }

    function failJob(

        uint256 jobId

    )

        external

        onlyOwner

    {

        jobs[jobId].status = JobStatus.Failed;

        emit JobFailed(jobId);

        if(address(reputationOracle)!=address(0)){

            reputationOracle.processFailedJob(

                jobs[jobId].agentId

            );

        }

    }

}