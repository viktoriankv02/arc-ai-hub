// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AIComputeRewards is Ownable {

    IERC20 public immutable rewardToken;

    uint256 public rewardPerJob = 5 ether;

    uint256 public totalRewardsPaid;

    mapping(address => uint256) public pendingRewards;

    mapping(address => uint256) public claimedRewards;

    event RewardAdded(
        address indexed node,
        uint256 amount
    );

    event RewardClaimed(
        address indexed node,
        uint256 amount
    );

    event RewardPerJobUpdated(
        uint256 amount
    );

    constructor(
        address token,
        address owner
    )
        Ownable(owner)
    {
        rewardToken = IERC20(token);
    }

    function addReward(
        address node
    )
        external
        onlyOwner
    {
        pendingRewards[node] += rewardPerJob;

        emit RewardAdded(
            node,
            rewardPerJob
        );
    }

    function addCustomReward(
        address node,
        uint256 amount
    )
        external
        onlyOwner
    {
        pendingRewards[node] += amount;

        emit RewardAdded(
            node,
            amount
        );
    }

    function claimReward()
        external
    {
        uint256 reward =
            pendingRewards[msg.sender];

        require(
            reward > 0,
            "No rewards"
        );

        pendingRewards[msg.sender] = 0;

        claimedRewards[msg.sender] += reward;

        totalRewardsPaid += reward;

        rewardToken.transfer(
            msg.sender,
            reward
        );

        emit RewardClaimed(
            msg.sender,
            reward
        );
    }

    function setRewardPerJob(
        uint256 amount
    )
        external
        onlyOwner
    {
        rewardPerJob = amount;

        emit RewardPerJobUpdated(
            amount
        );
    }

    function contractBalance()
        external
        view
        returns(uint256)
    {
        return rewardToken.balanceOf(
            address(this)
        );
    }
}