// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardDistributor is
    Ownable2Step,
    ReentrancyGuard
{
    IERC20 public immutable token;

    mapping(address => bool)
        public stakingContracts;

    event StakingAdded(
        address indexed staking
    );

    event StakingRemoved(
        address indexed staking
    );

    event RewardPaid(
        address indexed user,
        uint256 amount
    );

    constructor(
        address tokenAddress,
        address owner
    )
        Ownable(owner)
    {
        token = IERC20(tokenAddress);
    }

    modifier onlyStaking()
    {
        require(
            stakingContracts[msg.sender],
            "Not staking"
        );
        _;
    }