// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ActivityRegistry.sol";
import "./RewardPolicyEngine.sol";
import "./PointsLedger.sol";
import "./EligibilityEngine.sol";

/// @title RewardEngine
/// @notice Canonical settlement layer: verified activity -> policy -> eligibility -> points -> reward.
contract RewardEngine is Ownable, Pausable {
    using SafeERC20 for IERC20;

    ActivityRegistry public immutable activityRegistry;
    RewardPolicyEngine public immutable policyEngine;
    PointsLedger public immutable pointsLedger;
    EligibilityEngine public immutable eligibilityEngine;

    mapping(bytes32 => bool) public executed;
    mapping(address => bool) public executors;

    event ExecutorUpdated(address indexed executor, bool enabled);
    event RewardExecuted(bytes32 indexed claimId, bytes32 indexed policyId, bytes32 indexed activityId, address user, uint256 points, uint256 amount);
    event ERC20RewardExecuted(bytes32 indexed claimId, bytes32 indexed policyId, bytes32 indexed activityId, address user, address token, uint256 points, uint256 amount);

    error UnauthorizedExecutor();
    error AlreadyExecuted();
    error InvalidClaim();
    error InsufficientBalance();

    constructor(address initialOwner, address registry, address policy, address points, address eligibility) Ownable(initialOwner) {
        require(registry != address(0) && policy != address(0) && points != address(0) && eligibility != address(0), "Reward: zero address");
        activityRegistry = ActivityRegistry(registry);
        policyEngine = RewardPolicyEngine(policy);
        pointsLedger = PointsLedger(points);
        eligibilityEngine = EligibilityEngine(eligibility);
    }

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert UnauthorizedExecutor();
        _;
    }

    receive() external payable {}

    function setExecutor(address executor, bool enabled) external onlyOwner {
        require(executor != address(0), "Reward: zero executor");
        executors[executor] = enabled;
        emit ExecutorUpdated(executor, enabled);
    }

    function executeNative(bytes32 claimId, bytes32 policyId, bytes32 activityId, address payable user)
        external onlyExecutor whenNotPaused
    {
        _begin(claimId, activityId, user);
        ActivityRegistry.Activity memory activity = activityRegistry.getActivity(activityId);
        if (activity.id == bytes32(0) || activity.user != user) revert InvalidClaim();

        (uint256 points, uint256 amount) = policyEngine.consume(policyId, activityId, user, activity.verified);
        eligibilityEngine.consume(policyId, user, points, activity.verified);
        pointsLedger.credit(user, activityId, points);
        if (address(this).balance < amount) revert InsufficientBalance();

        (bool success,) = user.call{value: amount}("");
        require(success, "Reward: native transfer failed");
        emit RewardExecuted(claimId, policyId, activityId, user, points, amount);
    }

    function executeERC20(bytes32 claimId, bytes32 policyId, bytes32 activityId, address user, IERC20 token)
        external onlyExecutor whenNotPaused
    {
        _begin(claimId, activityId, user);
        if (address(token) == address(0)) revert InvalidClaim();
        ActivityRegistry.Activity memory activity = activityRegistry.getActivity(activityId);
        if (activity.id == bytes32(0) || activity.user != user) revert InvalidClaim();

        (uint256 points, uint256 amount) = policyEngine.consume(policyId, activityId, user, activity.verified);
        eligibilityEngine.consume(policyId, user, points, activity.verified);
        pointsLedger.credit(user, activityId, points);
        token.safeTransfer(user, amount);
        emit ERC20RewardExecuted(claimId, policyId, activityId, user, address(token), points, amount);
    }

    function fundNative() external payable {}
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _begin(bytes32 claimId, bytes32 activityId, address user) internal {
        if (claimId == bytes32(0) || activityId == bytes32(0) || user == address(0)) revert InvalidClaim();
        if (executed[claimId]) revert AlreadyExecuted();
        executed[claimId] = true;
    }
}
