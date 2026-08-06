// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PointsLedger
/// @notice Non-transferable reward points credited by authorized reward engines.
contract PointsLedger is Ownable {
    mapping(address => uint256) public pointsOf;
    mapping(address => mapping(bytes32 => bool)) public credited;
    mapping(address => bool) public writers;

    event WriterUpdated(address indexed writer, bool enabled);
    event PointsCredited(address indexed user, bytes32 indexed activityId, uint256 amount);
    event PointsRevoked(address indexed user, bytes32 indexed activityId, uint256 amount);

    error UnauthorizedWriter();
    error AlreadyCredited();
    error InsufficientPoints();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyWriter() {
        if (!writers[msg.sender]) revert UnauthorizedWriter();
        _;
    }

    function setWriter(address writer, bool enabled) external onlyOwner {
        writers[writer] = enabled;
        emit WriterUpdated(writer, enabled);
    }

    function credit(address user, bytes32 activityId, uint256 amount) external onlyWriter {
        if (credited[user][activityId]) revert AlreadyCredited();
        credited[user][activityId] = true;
        pointsOf[user] += amount;
        emit PointsCredited(user, activityId, amount);
    }

    function revoke(address user, bytes32 activityId, uint256 amount) external onlyWriter {
        if (!credited[user][activityId]) revert InsufficientPoints();
        if (pointsOf[user] < amount) revert InsufficientPoints();
        credited[user][activityId] = false;
        pointsOf[user] -= amount;
        emit PointsRevoked(user, activityId, amount);
    }
}
