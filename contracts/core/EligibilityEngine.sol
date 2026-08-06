// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title EligibilityEngine
/// @notice Enforces per-policy claim limits and cooldowns before rewards are paid.
contract EligibilityEngine is Ownable {
    struct Rule {
        uint256 minPoints;
        uint256 maxClaims;
        uint256 cooldown;
        bool requireVerified;
        bool active;
    }

    mapping(bytes32 => Rule) public rules;
    mapping(bytes32 => mapping(address => uint256)) public claimCount;
    mapping(bytes32 => mapping(address => uint256)) public lastClaimAt;
    mapping(address => bool) public consumers;

    event RuleSet(bytes32 indexed policyId, uint256 minPoints, uint256 maxClaims, uint256 cooldown, bool requireVerified, bool active);
    event ConsumerUpdated(address indexed consumer, bool enabled);
    event EligibilityConsumed(bytes32 indexed policyId, address indexed user, uint256 points);

    error UnauthorizedConsumer();
    error Ineligible();
    error ClaimLimitReached();
    error CooldownActive();
    error VerificationRequired();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyConsumer() {
        if (!consumers[msg.sender]) revert UnauthorizedConsumer();
        _;
    }

    function setConsumer(address consumer, bool enabled) external onlyOwner {
        consumers[consumer] = enabled;
        emit ConsumerUpdated(consumer, enabled);
    }

    function setRule(
        bytes32 policyId,
        uint256 minPoints,
        uint256 maxClaims,
        uint256 cooldown,
        bool requireVerified,
        bool active
    ) external onlyOwner {
        rules[policyId] = Rule(minPoints, maxClaims, cooldown, requireVerified, active);
        emit RuleSet(policyId, minPoints, maxClaims, cooldown, requireVerified, active);
    }

    function consume(bytes32 policyId, address user, uint256 points, bool verified) external onlyConsumer {
        Rule memory rule = rules[policyId];
        if (!rule.active || points < rule.minPoints) revert Ineligible();
        if (rule.requireVerified && !verified) revert VerificationRequired();
        if (rule.maxClaims != 0 && claimCount[policyId][user] >= rule.maxClaims) revert ClaimLimitReached();
        if (rule.cooldown != 0 && lastClaimAt[policyId][user] != 0 && block.timestamp < lastClaimAt[policyId][user] + rule.cooldown) {
            revert CooldownActive();
        }

        claimCount[policyId][user] += 1;
        lastClaimAt[policyId][user] = block.timestamp;
        emit EligibilityConsumed(policyId, user, points);
    }
}
