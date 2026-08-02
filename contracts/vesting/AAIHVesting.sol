// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AAIHVesting is
    Ownable2Step,
    ReentrancyGuard
{
    IERC20 public immutable token;

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool revocable;
        bool revoked;
    }

    uint256 public vestingCount;

    mapping(uint256 => VestingSchedule)
        public vestings;

    event VestingCreated(
        uint256 indexed id,
        address indexed beneficiary,
        uint256 amount
    );

    event TokensReleased(
        uint256 indexed id,
        uint256 amount
    );

    event VestingRevoked(
        uint256 indexed id
    );

    constructor(
        address tokenAddress,
        address owner
    )
        Ownable(owner)
    {
        token = IERC20(tokenAddress);
    }