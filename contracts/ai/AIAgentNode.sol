// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AIAgentNode is Ownable {

    enum NodeStatus {
        Offline,
        Online,
        Busy
    }

    struct Node {

        uint256 id;

        address owner;

        string endpoint;

        uint256 cpu;

        uint256 ram;

        uint256 gpu;

        uint256 bandwidth;

        uint256 reputation;

        uint256 completedJobs;

        uint256 income;

        NodeStatus status;

    }

    uint256 public nextNodeId;

    mapping(uint256 => Node) public nodes;

    mapping(address => uint256[]) public ownerNodes;

    event NodeRegistered(
        uint256 indexed nodeId,
        address indexed owner
    );

    event NodeOnline(
        uint256 indexed nodeId
    );

    event NodeOffline(
        uint256 indexed nodeId
    );

    event JobCompleted(
        uint256 indexed nodeId,
        uint256 reward
    );

    constructor(address owner)
        Ownable(owner)
    {}

    function registerNode(

        string calldata endpoint,

        uint256 cpu,

        uint256 ram,

        uint256 gpu,

        uint256 bandwidth

    )

        external

    {

        nodes[nextNodeId] = Node({

            id: nextNodeId,

            owner: msg.sender,

            endpoint: endpoint,

            cpu: cpu,

            ram: ram,

            gpu: gpu,

            bandwidth: bandwidth,

            reputation: 0,

            completedJobs: 0,

            income: 0,

            status: NodeStatus.Offline

        });

        ownerNodes[msg.sender].push(nextNodeId);

        emit NodeRegistered(
            nextNodeId,
            msg.sender
        );

        nextNodeId++;

    }

    function setOnline(
        uint256 nodeId
    )

        external

    {

        require(
            nodes[nodeId].owner == msg.sender,
            "Not owner"
        );

        nodes[nodeId].status = NodeStatus.Online;

        emit NodeOnline(nodeId);

    }

    function setOffline(
        uint256 nodeId
    )

        external

    {

        require(
            nodes[nodeId].owner == msg.sender,
            "Not owner"
        );

        nodes[nodeId].status = NodeStatus.Offline;

        emit NodeOffline(nodeId);

    }

    function finishJob(

        uint256 nodeId,

        uint256 reward

    )

        external

        onlyOwner

    {

        Node storage node = nodes[nodeId];

        node.completedJobs++;

        node.income += reward;

        node.reputation++;

        node.status = NodeStatus.Online;

        emit JobCompleted(
            nodeId,
            reward
        );

    }

    function getOwnerNodes(
        address ownerAddress
    )

        external

        view

        returns(uint256[] memory)

    {

        return ownerNodes[ownerAddress];

    }

}