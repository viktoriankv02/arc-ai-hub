// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AIJobManager.sol";

/// @title AIAPIGateway
/// @notice On-chain request entry point that creates a corresponding AI job.
contract AIAPIGateway is Ownable {
    AIJobManager public jobManager;

    struct APIRequest {
        uint256 id;
        address user;
        uint256 serviceId;
        string payloadHash;
        uint256 timestamp;
        bool processed;
    }

    uint256 public nextRequestId;
    mapping(uint256 => APIRequest) public requests;

    event RequestCreated(uint256 indexed requestId, address indexed user, uint256 indexed serviceId);
    event RequestProcessed(uint256 indexed requestId);
    event JobManagerUpdated(address indexed jobManager);

    constructor(address initialOwner, address jobManagerAddress) Ownable(initialOwner) {
        require(jobManagerAddress != address(0), "Gateway: zero job manager");
        jobManager = AIJobManager(jobManagerAddress);
    }

    function setJobManager(address jobManagerAddress) external onlyOwner {
        require(jobManagerAddress != address(0), "Gateway: zero job manager");
        jobManager = AIJobManager(jobManagerAddress);
        emit JobManagerUpdated(jobManagerAddress);
    }

    function createRequest(
        uint256 serviceId,
        string calldata payloadHash
    ) external returns (uint256 requestId) {
        requestId = nextRequestId;

        requests[requestId] = APIRequest({
            id: requestId,
            user: msg.sender,
            serviceId: serviceId,
            payloadHash: payloadHash,
            timestamp: block.timestamp,
            processed: false
        });

        emit RequestCreated(requestId, msg.sender, serviceId);

        jobManager.createJobFromGateway(
            msg.sender,
            serviceId,
            requestId,
            0
        );

        nextRequestId++;
    }

    function markProcessed(uint256 requestId) external onlyOwner {
        require(requests[requestId].timestamp != 0, "Gateway: request not found");
        requests[requestId].processed = true;
        emit RequestProcessed(requestId);
    }
}
