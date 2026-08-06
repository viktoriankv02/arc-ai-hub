// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ActivityRegistry.sol";
import "./RewardPolicyEngine.sol";
import "./PointsLedger.sol";
import "./EligibilityEngine.sol";

/// @title RewardEngine
/// @notice Single orchestration layer: verified activity -> policy -> eligibility -> points -> native reward.
contract RewardEngine is Ownable, Pausable {
    ActivityRegistry public immutable activityRegistry;
    RewardPolicyEngine public immutable policyEngine;
    PointsLedger public immutable pointsLedger;
    EligibilityEngine public immutable eligibilityEngine;

    mapping(bytes32 => bool) public executed;

    event RewardExecuted(
        bytes32 indexed claimId,
        bytes32 indexed policyId,
        bytes32 indexed activityId,
        address user,
        uint256 points,
        uint256 amount
    );

    error AlreadyExecuted();
    error InvalidClaim();
    error InsufficientBalance();

    constructor(
        address initialOwner,
        address registry,
        address policy,
        address points,
        address eligibility
    ) Ownable(initialOwner) {
        require(registry != address(0), "Reward: zero registry");
        require(policy != address(0), "Reward: zero policy");
        require(points != address(0), "Reward: zero points");
        require(eligibility != address(0), "Reward: zero eligibility");
        activityRegistry = ActivityRegistry(registry);
        policyEngine = RewardPolicyEngine(policy);
        pointsLedger = PointsLedger(points);
        eligibilityEngine = EligibilityEngine(eligibility);
    }

    receive() external payable {}

    function executeNative(
        bytes32 claimId,
        bytes32 policyId,
        bytes32 activityId,
        address payable user
    ) external onlyOwner whenNotPaused {
        if (claimId == bytes32(0) || activityId == bytes32(0) || user == address(0)) revert InvalidClaim();
        if (executed[claimId]) revert AlreadyExecuted();

        ActivityRegistry.Activity memory activity = activityRegistry.getActivity(activityId);
        if (activity.id == bytes32(0) || activity.user != user) revert InvalidClaim();

        executed[claimId] = true;
        (uint256 points, uint256 amount) = policyEngine.consume(
            policyId,
            activityId,
            user,
            activity.verified
        );
        eligibilityEngine.consume(policyId, user, points, activity.verified);
        pointsLedger.credit(user, activityId, points);

        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = user.call{value: amount}("");
        require(success, "Reward: native transfer failed");

        emit RewardExecuted(claimId, policyId, activityId, user, points, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
