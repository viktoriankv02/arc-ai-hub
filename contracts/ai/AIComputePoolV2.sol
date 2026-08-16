// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AIComputePoolV2
/// @notice Compute node registry with controller-authorized job settlement.
contract AIComputePoolV2 is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    uint256 public constant minimumStake = 1000 ether;

    enum NodeStatus { Offline, Online, Busy, Disabled }

    struct ComputeNode {
        uint256 id;
        address owner;
        string gpuModel;
        uint32 gpuMemory;
        uint16 cpuCores;
        uint32 ram;
        string region;
        uint256 stake;
        uint256 reputation;
        uint256 completedJobs;
        uint256 failedJobs;
        uint256 lastHeartbeat;
        NodeStatus status;
        uint256 totalReward;
        uint256 activeJobs;
        uint256 score;
    }

    uint256 public nextNodeId;
    mapping(uint256 => ComputeNode) internal nodes;
    mapping(address => uint256[]) internal ownerNodes;
    mapping(address => bool) public controllers;
    mapping(uint256 => uint256) public activeJobByNode;

    event ControllerUpdated(address indexed controller, bool enabled);
    event NodeRegistered(uint256 indexed nodeId, address indexed owner);
    event NodeHeartbeat(uint256 indexed nodeId);
    event JobStarted(uint256 indexed jobId, uint256 indexed nodeId);
    event JobFinished(uint256 indexed jobId, uint256 indexed nodeId, uint256 reward);
    event JobFailed(uint256 indexed jobId, uint256 indexed nodeId);
    event NodeDisabled(uint256 indexed nodeId);

    error NotController();
    error NotNodeOwner();
    error NodeNotFound();
    error InvalidNodeState();
    error JobMismatch();

    constructor(address token, address initialOwner) Ownable(initialOwner) {
        require(token != address(0), "Pool: zero token");
        rewardToken = IERC20(token);
    }

    modifier onlyController() {
        if (!controllers[msg.sender]) revert NotController();
        _;
    }

    modifier validNode(uint256 nodeId) {
        if (nodeId >= nextNodeId || nodes[nodeId].owner == address(0)) revert NodeNotFound();
        _;
    }

    function setController(address controller, bool enabled) external onlyOwner {
        require(controller != address(0), "Pool: zero controller");
        controllers[controller] = enabled;
        emit ControllerUpdated(controller, enabled);
    }

    function registerNode(
        string calldata gpuModel,
        uint32 gpuMemory,
        uint16 cpuCores,
        uint32 ram,
        string calldata region,
        uint256 stake
    ) external returns (uint256 nodeId) {
        require(stake >= minimumStake, "Low stake");
        rewardToken.safeTransferFrom(msg.sender, address(this), stake);
        nodeId = nextNodeId++;
        nodes[nodeId] = ComputeNode({
            id: nodeId,
            owner: msg.sender,
            gpuModel: gpuModel,
            gpuMemory: gpuMemory,
            cpuCores: cpuCores,
            ram: ram,
            region: region,
            stake: stake,
            reputation: 100,
            completedJobs: 0,
            failedJobs: 0,
            lastHeartbeat: block.timestamp,
            status: NodeStatus.Online,
            totalReward: 0,
            activeJobs: 0,
            score: 100
        });
        ownerNodes[msg.sender].push(nodeId);
        emit NodeRegistered(nodeId, msg.sender);
    }

    function heartbeat(uint256 nodeId) external validNode(nodeId) {
        ComputeNode storage node = nodes[nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner();
        if (node.status == NodeStatus.Disabled) revert InvalidNodeState();
        node.lastHeartbeat = block.timestamp;
        emit NodeHeartbeat(nodeId);
    }

    function startJob(uint256 jobId, uint256 nodeId) external onlyController validNode(nodeId) {
        ComputeNode storage node = nodes[nodeId];
        if (node.status != NodeStatus.Online) revert InvalidNodeState();
        node.status = NodeStatus.Busy;
        node.activeJobs++;
        activeJobByNode[nodeId] = jobId;
        emit JobStarted(jobId, nodeId);
    }

    function finishJob(uint256 jobId, uint256 nodeId, uint256 reward) external onlyController validNode(nodeId) {
        ComputeNode storage node = nodes[nodeId];
        if (activeJobByNode[nodeId] != jobId) revert JobMismatch();
        if (node.status != NodeStatus.Busy) revert InvalidNodeState();
        node.status = NodeStatus.Online;
        if (node.activeJobs > 0) node.activeJobs--;
        delete activeJobByNode[nodeId];
        node.completedJobs++;
        node.totalReward += reward;
        node.reputation += 1;
        node.score += 1;
        if (reward > 0) rewardToken.safeTransfer(node.owner, reward);
        emit JobFinished(jobId, nodeId, reward);
    }

    function failJob(uint256 jobId, uint256 nodeId) external onlyController validNode(nodeId) {
        ComputeNode storage node = nodes[nodeId];
        if (activeJobByNode[nodeId] != jobId) revert JobMismatch();
        if (node.status != NodeStatus.Busy) revert InvalidNodeState();
        node.status = NodeStatus.Online;
        if (node.activeJobs > 0) node.activeJobs--;
        delete activeJobByNode[nodeId];
        node.failedJobs++;
        if (node.reputation > 0) node.reputation--;
        emit JobFailed(jobId, nodeId);
    }

    function disableNode(uint256 nodeId) external validNode(nodeId) {
        ComputeNode storage node = nodes[nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner();
        if (node.activeJobs != 0) revert InvalidNodeState();
        node.status = NodeStatus.Disabled;
        emit NodeDisabled(nodeId);
    }

    function getNode(uint256 nodeId) external view validNode(nodeId) returns (ComputeNode memory) {
        return nodes[nodeId];
    }

    function getOwnerNodes(address owner) external view returns (uint256[] memory) {
        return ownerNodes[owner];
    }
}
