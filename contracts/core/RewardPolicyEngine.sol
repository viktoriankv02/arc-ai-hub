// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IActivityRegistry {
    function getActivity(bytes32 activityId) external view returns (
        bytes32 id,
        address user,
        uint256 chainId,
        bytes32 activityType,
        bytes32 projectId,
        bytes32 sourceActivityId,
        bytes32 metadataHash,
        bool verified,
        uint256 timestamp
    );
}

/// @title RewardPolicyEngine
/// @notice Matches verified activities to reward policies and consumes a policy once per user/activity.
contract RewardPolicyEngine is Ownable {
    struct Policy {
        bytes32 activityType;
        uint256 chainId;
        uint256 points;
        uint256 rewardAmount;
        bool verifiedOnly;
        bool active;
    }

    IActivityRegistry public immutable activityRegistry;
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => mapping(address => bool)) public userClaimed;
    mapping(bytes32 => mapping(bytes32 => bool)) public activityClaimed;
    mapping(address => bool) public claimers;

    event PolicySet(
        bytes32 indexed policyId,
        bytes32 indexed activityType,
        uint256 chainId,
        uint256 points,
        uint256 rewardAmount,
        bool verifiedOnly,
        bool active
    );
    event ClaimerUpdated(address indexed claimer, bool enabled);
    event PolicyConsumed(bytes32 indexed policyId, bytes32 indexed activityId, address indexed user);

    error UnauthorizedClaimer();
    error InactivePolicy();
    error InvalidActivity();
    error ActivityMismatch();
    error VerificationRequired();
    error AlreadyClaimed();

    constructor(address initialOwner, address registry) Ownable(initialOwner) {
        require(registry != address(0), "Policy: zero registry");
        activityRegistry = IActivityRegistry(registry);
    }

    modifier onlyClaimer() {
        if (!claimers[msg.sender]) revert UnauthorizedClaimer();
        _;
    }

    function setClaimer(address claimer, bool enabled) external onlyOwner {
        claimers[claimer] = enabled;
        emit ClaimerUpdated(claimer, enabled);
    }

    function setPolicy(
        bytes32 policyId,
        bytes32 activityType,
        uint256 chainId,
        uint256 points,
        uint256 rewardAmount,
        bool verifiedOnly,
        bool active
    ) external onlyOwner {
        policies[policyId] = Policy({
            activityType: activityType,
            chainId: chainId,
            points: points,
            rewardAmount: rewardAmount,
            verifiedOnly: verifiedOnly,
            active: active
        });
        emit PolicySet(
            policyId,
            activityType,
            chainId,
            points,
            rewardAmount,
            verifiedOnly,
            active
        );
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function consume(
        bytes32 policyId,
        bytes32 activityId,
        address user,
        bool verified
    ) external onlyClaimer returns (uint256 points, uint256 rewardAmount) {
        Policy memory policy = policies[policyId];
        if (!policy.active) revert InactivePolicy();
        if (userClaimed[policyId][user] || activityClaimed[policyId][activityId]) revert AlreadyClaimed();

        (
            bytes32 id,
            address activityUser,
            uint256 chainId,
            bytes32 activityType,
            ,
            ,
            ,
            bool activityVerified,
        ) = activityRegistry.getActivity(activityId);

        if (id == bytes32(0) || activityUser != user) revert InvalidActivity();
        if (chainId != policy.chainId || activityType != policy.activityType) revert ActivityMismatch();
        if (policy.verifiedOnly && (!verified || !activityVerified)) revert VerificationRequired();

        userClaimed[policyId][user] = true;
        activityClaimed[policyId][activityId] = true;

        emit PolicyConsumed(policyId, activityId, user);
        return (policy.points, policy.rewardAmount);
    }
}
