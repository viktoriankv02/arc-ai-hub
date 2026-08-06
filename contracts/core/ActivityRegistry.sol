// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ActivityRegistry
/// @notice Canonical on-chain registry for verified user/agent activity.
contract ActivityRegistry is Ownable {
    struct Activity {
        bytes32 id;
        address user;
        uint256 chainId;
        bytes32 activityType;
        bytes32 projectId;
        bytes32 sourceActivityId;
        bytes32 metadataHash;
        bool verified;
        uint256 timestamp;
    }

    mapping(bytes32 => bool) public supportedActivityType;
    mapping(address => bool) public reporters;
    mapping(bytes32 => Activity) private activities;
    mapping(address => bytes32[]) private userActivities;

    event ActivityTypeUpdated(bytes32 indexed activityType, bool supported);
    event ReporterUpdated(address indexed reporter, bool enabled);
    event ActivityRecorded(
        bytes32 indexed activityId,
        address indexed user,
        uint256 indexed chainId,
        bytes32 activityType,
        bytes32 projectId,
        bool verified
    );

    error UnauthorizedReporter();
    error UnsupportedActivityType();
    error InvalidUser();
    error InvalidActivityId();
    error DuplicateActivity();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyReporter() {
        if (!reporters[msg.sender]) revert UnauthorizedReporter();
        _;
    }

    function setActivityType(bytes32 activityType, bool supported) external onlyOwner {
        supportedActivityType[activityType] = supported;
        emit ActivityTypeUpdated(activityType, supported);
    }

    function setReporter(address reporter, bool enabled) external onlyOwner {
        reporters[reporter] = enabled;
        emit ReporterUpdated(reporter, enabled);
    }

    function recordActivity(
        address user,
        uint256 chainId,
        bytes32 activityType,
        bytes32 projectId,
        bytes32 sourceActivityId,
        bytes32 metadataHash,
        bool verified
    ) external onlyReporter returns (bytes32 activityId) {
        if (user == address(0)) revert InvalidUser();
        if (!supportedActivityType[activityType]) revert UnsupportedActivityType();
        if (sourceActivityId == bytes32(0)) revert InvalidActivityId();

        activityId = keccak256(
            abi.encode(user, chainId, activityType, projectId, sourceActivityId)
        );
        if (activities[activityId].timestamp != 0) revert DuplicateActivity();

        activities[activityId] = Activity({
            id: activityId,
            user: user,
            chainId: chainId,
            activityType: activityType,
            projectId: projectId,
            sourceActivityId: sourceActivityId,
            metadataHash: metadataHash,
            verified: verified,
            timestamp: block.timestamp
        });
        userActivities[user].push(activityId);

        emit ActivityRecorded(
            activityId,
            user,
            chainId,
            activityType,
            projectId,
            verified
        );
    }

    function getActivity(bytes32 activityId) external view returns (Activity memory) {
        return activities[activityId];
    }

    function activityExists(bytes32 activityId) external view returns (bool) {
        return activities[activityId].timestamp != 0;
    }

    function getUserActivities(address user) external view returns (bytes32[] memory) {
        return userActivities[user];
    }
}
