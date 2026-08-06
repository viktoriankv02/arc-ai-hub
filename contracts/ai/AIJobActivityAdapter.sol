// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAIJobEngine {
    function jobs(uint256 jobId) external view returns (
        uint256 id,
        address creator,
        uint256 agentId,
        string memory task,
        uint256 reward,
        bool assigned,
        bool completed,
        uint256 createdAt,
        uint256 completedAt
    );
}

interface IAgentRuntime {
    function getAgent(uint256 agentId) external view returns (
        uint256 id,
        address owner,
        string memory name,
        string memory endpoint,
        string memory metadataURI,
        string memory version,
        uint256 createdAt,
        uint256 updatedAt,
        uint256 heartbeat,
        uint8 status,
        bool exists
    );
}

interface IActivitySink {
    function recordActivity(
        address user,
        uint256 chainId,
        bytes32 activityType,
        bytes32 projectId,
        bytes32 sourceActivityId,
        bytes32 metadataHash,
        bool verified
    ) external returns (bytes32 activityId);
}

/// @title AIJobActivityAdapter
/// @notice Bridges completed AI jobs into the canonical activity/reward pipeline.
contract AIJobActivityAdapter is Ownable {
    IAIJobEngine public immutable jobEngine;
    IAgentRuntime public immutable runtime;
    IActivitySink public immutable activityRegistry;

    bytes32 public immutable activityType;
    bytes32 public immutable projectId;
    uint256 public immutable chainId;

    mapping(uint256 => bool) public reported;

    event JobActivityReported(uint256 indexed jobId, address indexed beneficiary, bytes32 indexed activityId);

    error InvalidJob();
    error AlreadyReported();
    error InvalidAgent();

    constructor(
        address initialOwner,
        address jobEngineAddress,
        address runtimeAddress,
        address registryAddress,
        uint256 sourceChainId,
        bytes32 jobActivityType,
        bytes32 jobProjectId
    ) Ownable(initialOwner) {
        require(jobEngineAddress != address(0), "Adapter: zero job engine");
        require(runtimeAddress != address(0), "Adapter: zero runtime");
        require(registryAddress != address(0), "Adapter: zero registry");
        jobEngine = IAIJobEngine(jobEngineAddress);
        runtime = IAgentRuntime(runtimeAddress);
        activityRegistry = IActivitySink(registryAddress);
        chainId = sourceChainId;
        activityType = jobActivityType;
        projectId = jobProjectId;
    }

    function reportCompletedJob(uint256 jobId, bytes32 metadataHash)
        external
        onlyOwner
        returns (bytes32 activityId)
    {
        if (reported[jobId]) revert AlreadyReported();

        (
            uint256 id,
            ,
            uint256 agentId,
            ,
            ,
            ,
            bool completed,
            ,
        ) = jobEngine.jobs(jobId);
        if (!completed || id != jobId) revert InvalidJob();

        (, address beneficiary, , , , , , , , , bool exists) = runtime.getAgent(agentId);
        if (!exists || beneficiary == address(0)) revert InvalidAgent();

        bytes32 sourceActivityId = keccak256(abi.encode("AI_JOB", jobId));
        activityId = activityRegistry.recordActivity(
            beneficiary,
            chainId,
            activityType,
            projectId,
            sourceActivityId,
            metadataHash,
            true
        );

        reported[jobId] = true;
        emit JobActivityReported(jobId, beneficiary, activityId);
    }
}
