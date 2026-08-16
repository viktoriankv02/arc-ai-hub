// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AIReputation.sol";

/// @title AIReputationOracleV2
/// @notice Allows an authorized job manager to report job outcomes to the reputation contract.
contract AIReputationOracleV2 is Ownable {
    AIReputation public immutable reputation;
    mapping(address => bool) public controllers;

    event ControllerUpdated(address indexed controller, bool enabled);
    event ReputationProcessed(uint256 indexed agentId, bool success, uint256 reward);

    error NotController();

    constructor(address reputationContract, address initialOwner) Ownable(initialOwner) {
        require(reputationContract != address(0), "Oracle: zero reputation");
        reputation = AIReputation(reputationContract);
    }

    modifier onlyController() {
        if (!controllers[msg.sender]) revert NotController();
        _;
    }

    function setController(address controller, bool enabled) external onlyOwner {
        require(controller != address(0), "Oracle: zero controller");
        controllers[controller] = enabled;
        emit ControllerUpdated(controller, enabled);
    }

    function processSuccessfulJob(uint256 agentId, uint256 reward) external onlyController {
        reputation.addSuccessfulJob(agentId);
        reputation.addEarnings(agentId, reward);
        reputation.increaseInference(agentId);
        emit ReputationProcessed(agentId, true, reward);
    }

    function processFailedJob(uint256 agentId) external onlyController {
        reputation.addFailedJob(agentId);
        emit ReputationProcessed(agentId, false, 0);
    }

    function processRating(uint256 agentId, uint8 rating) external onlyController {
        reputation.addRating(agentId, rating);
    }

    function processHeartbeat(uint256 agentId) external onlyController {
        reputation.increaseUptime(agentId, 1);
    }
}
