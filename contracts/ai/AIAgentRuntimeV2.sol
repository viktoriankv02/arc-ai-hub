// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AIAgentRuntimeV2
/// @notice Agent lifecycle runtime with explicit controller authorization for orchestrators/job managers.
contract AIAgentRuntimeV2 is Ownable {
    enum AgentStatus {
        Inactive,
        Running,
        Paused,
        Stopped,
        Slashed
    }

    error NotAgentOwner();
    error NotController();
    error AgentNotFound();
    error ZeroAddress();

    struct Agent {
        uint256 id;
        address owner;
        string name;
        string endpoint;
        string metadataURI;
        string version;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 heartbeat;
        AgentStatus status;
        bool exists;
    }

    uint256 public nextAgentId;

    mapping(uint256 => Agent) private agents;
    mapping(address => uint256[]) private ownerAgents;
    mapping(address => bool) private controllers;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name);
    event AgentStarted(uint256 indexed agentId);
    event AgentPaused(uint256 indexed agentId);
    event AgentStopped(uint256 indexed agentId);
    event Heartbeat(uint256 indexed agentId, uint256 timestamp);
    event MetadataUpdated(uint256 indexed agentId);
    event ControllerUpdated(address indexed controller, bool enabled);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAgentOwner(uint256 agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();
        _;
    }

    modifier onlyController() {
        if (!controllers[msg.sender]) revert NotController();
        _;
    }

    modifier onlyAgentOperator(uint256 agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (agent.owner != msg.sender && !controllers[msg.sender]) revert NotAgentOwner();
        _;
    }

    function setController(address controller, bool enabled) external onlyOwner {
        if (controller == address(0)) revert ZeroAddress();
        controllers[controller] = enabled;
        emit ControllerUpdated(controller, enabled);
    }

    function isController(address controller) external view returns (bool) {
        return controllers[controller];
    }

    function registerAgent(
        string calldata name,
        string calldata endpoint,
        string calldata metadataURI,
        string calldata version
    ) external returns (uint256 agentId) {
        agentId = nextAgentId;

        agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            name: name,
            endpoint: endpoint,
            metadataURI: metadataURI,
            version: version,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            heartbeat: block.timestamp,
            status: AgentStatus.Inactive,
            exists: true
        });

        ownerAgents[msg.sender].push(agentId);
        nextAgentId++;

        emit AgentRegistered(agentId, msg.sender, name);
    }

    function startAgent(uint256 agentId) external onlyAgentOperator(agentId) {
        Agent storage agent = agents[agentId];
        agent.status = AgentStatus.Running;
        agent.updatedAt = block.timestamp;
        emit AgentStarted(agentId);
    }

    function pauseAgent(uint256 agentId) external onlyAgentOperator(agentId) {
        Agent storage agent = agents[agentId];
        agent.status = AgentStatus.Paused;
        agent.updatedAt = block.timestamp;
        emit AgentPaused(agentId);
    }

    function stopAgent(uint256 agentId) external onlyAgentOperator(agentId) {
        Agent storage agent = agents[agentId];
        agent.status = AgentStatus.Stopped;
        agent.updatedAt = block.timestamp;
        emit AgentStopped(agentId);
    }

    function heartbeat(uint256 agentId) external onlyAgentOperator(agentId) {
        Agent storage agent = agents[agentId];
        agent.heartbeat = block.timestamp;
        emit Heartbeat(agentId, block.timestamp);
    }

    function updateMetadata(
        uint256 agentId,
        string calldata endpoint,
        string calldata metadataURI,
        string calldata version
    ) external onlyAgentOperator(agentId) {
        Agent storage agent = agents[agentId];
        agent.endpoint = endpoint;
        agent.metadataURI = metadataURI;
        agent.version = version;
        agent.updatedAt = block.timestamp;
        emit MetadataUpdated(agentId);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getOwnerAgents(address owner) external view returns (uint256[] memory) {
        return ownerAgents[owner];
    }
}
