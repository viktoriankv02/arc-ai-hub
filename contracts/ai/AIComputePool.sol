// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AIComputePool is Ownable {

    IERC20 public immutable rewardToken;

    uint256 public constant DENOMINATOR = 10000;

    uint256 public nextNodeId;

    uint256 public minimumStake = 1000 ether;

    enum NodeStatus {
        Offline,
        Online,
        Busy,
        Disabled
    }

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

    mapping(uint256 => ComputeNode) internal nodes;

    mapping(address => uint256[]) internal ownerNodes;

    event NodeRegistered(
        uint256 indexed nodeId,
        address indexed owner
    );

    event NodeUpdated(
        uint256 indexed nodeId
    );

    event NodeHeartbeat(
        uint256 indexed nodeId
    );

    event NodeDisabled(
        uint256 indexed nodeId
    );

    constructor(
        address token,
        address initialOwner
    )
        Ownable(initialOwner)
    {
        rewardToken = IERC20(token);
    }

    function registerNode(
        string calldata gpuModel,
        uint32 gpuMemory,
        uint16 cpuCores,
        uint32 ram,
        string calldata region,
        uint256 stake
    )
        external
    {
        require(
            stake >= minimumStake,
            "Low stake"
        );

        rewardToken.transferFrom(
            msg.sender,
            address(this),
            stake
        );

        nodes[nextNodeId] = ComputeNode({
            id: nextNodeId,
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

        ownerNodes[msg.sender].push(nextNodeId);

        emit NodeRegistered(
            nextNodeId,
            msg.sender
        );

        nextNodeId++;
    }

    function heartbeat(
        uint256 nodeId
    )
        external
    {
        ComputeNode storage node =
            nodes[nodeId];

        require(
            node.owner == msg.sender,
            "Not owner"
        );

        node.lastHeartbeat =
            block.timestamp;

        emit NodeHeartbeat(nodeId);
    }

    function setBusy(
        uint256 nodeId
    )
        external
    {
        ComputeNode storage node =
            nodes[nodeId];

        require(
            node.owner == msg.sender,
            "Not owner"
        );

        node.status =
            NodeStatus.Busy;

        node.activeJobs++;
    }

    function finishJob(
        uint256 nodeId,
        uint256 reward
    )
        external
    {
        ComputeNode storage node =
            nodes[nodeId];

        require(
            node.owner == msg.sender,
            "Not owner"
        );

        node.status =
            NodeStatus.Online;

        node.completedJobs++;

        if(node.activeJobs>0)
            node.activeJobs--;

        node.totalReward += reward;

        rewardToken.transfer(
            node.owner,
            reward
        );
    }

    function disableNode(
        uint256 nodeId
    )
        external
    {
        ComputeNode storage node =
            nodes[nodeId];

        require(
            node.owner == msg.sender,
            "Not owner"
        );

        node.status =
            NodeStatus.Disabled;

        emit NodeDisabled(nodeId);
    }

    function getNode(
        uint256 nodeId
    )
        external
        view
        returns(
            ComputeNode memory
        )
    {
        return nodes[nodeId];
    }

    function getOwnerNodes(
        address owner
    )
        external
        view
        returns(
            uint256[] memory
        )
    {
        return ownerNodes[owner];
    }

}