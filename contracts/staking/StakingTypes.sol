// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Інформація про депозит користувача
struct StakePosition {
    uint256 amount;
    uint64 startTime;
    uint64 unlockTime;
    uint16 poolId;
    bool withdrawn;
}

/// @notice Параметри пулу стейкінгу
struct PoolInfo {
    uint16 apy;
    uint32 lockDays;
    bool active;
}