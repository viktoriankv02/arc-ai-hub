// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AIJobManagerV2.sol";

/// @title AIAPIGatewayV2
/// @notice Creates on-chain requests and forwards them to AIJobManagerV2.
contract AIAPIGatewayV2 is Ownable {
    AIJobManagerV2 public jobManager;
    uint256 public nextRequestId;

    struct APIRequest {
        uint256 id;
        address user;
        uint256 serviceId;
        string payloadHash;
        uint256 timestamp;
        bool processed;
    }

    mapping(uint256 => APIRequest) public requests;

    event JobManagerUpdated(address indexed jobManager);
    event RequestCreated(uint256 indexed requestId, address indexed user, uint256 indexed serviceId, uint256 jobId);
    event RequestProcessed(uint256 indexed requestId);

    constructor(address initialOwner, address jobManagerAddress) Ownable(initialOwner) {
        require(jobManagerAddress != address(0), "Gateway: zero manager");
        jobManager = AIJobManagerV2(jobManagerAddress);
    }

    function setJobManager(address manager) external onlyOwner {
        require(manager != address(0), "Gateway: zero manager");
        jobManager = AIJobManagerV2(manager);
        emit JobManagerUpdated(manager);
    }

    function createRequest(uint256 serviceId, string calldata payloadHash, uint256 reward) external returns (uint256 requestId, uint256 jobId) {
        requestId = nextRequestId++;
        requests[requestId] = APIRequest(requestId, msg.sender, serviceId, payloadHash, block.timestamp, false);
        jobId = jobManager.createJobFromGateway(msg.sender, serviceId, requestId, reward);
        emit RequestCreated(requestId, msg.sender, serviceId, jobId);
    }

    function markProcessed(uint256 requestId) external onlyOwner {
        require(requests[requestId].timestamp != 0, "Gateway: not found");
        requests[requestId].processed = true;
        emit RequestProcessed(requestId);
    }
}
