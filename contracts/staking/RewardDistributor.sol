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
        // =====================================================
    //          STAKING MANAGEMENT
    // =====================================================

    function addStaking(
        address staking
    )
        external
        onlyOwner
    {
        require(
            staking != address(0),
            "Zero address"
        );

        stakingContracts[staking] = true;

        emit StakingAdded(
            staking
        );
    }

    function removeStaking(
        address staking
    )
        external
        onlyOwner
    {
        stakingContracts[staking] = false;

        emit StakingRemoved(
            staking
        );
    }

    function isStaking(
        address staking
    )
        external
        view
        returns(bool)
    {
        return stakingContracts[staking];
    }

    // =====================================================
    //              REWARD PAYMENTS
    // =====================================================

    function payReward(
        address user,
        uint256 amount
    )
        external
        onlyStaking
        nonReentrant
    {
        if(amount == 0)
            return;

        bool ok =
            token.transfer(
                user,
                amount
            );

        require(
            ok,
            "Reward transfer failed"
        );

        emit RewardPaid(
            user,
            amount
        );
    }

    // =====================================================
    //             CONTRACT BALANCE
    // =====================================================

    function rewardBalance()
        external
        view
        returns(uint256)
    {
        return token.balanceOf(
            address(this)
        );
    }

    // =====================================================
    //           OWNER RECOVERY
    // =====================================================

    function withdrawUnused(
        address to,
        uint256 amount
    )
        external
        onlyOwner
    {
        bool ok =
            token.transfer(
                to,
                amount
            );

        require(
            ok,
            "Transfer failed"
        );
    }

    // =====================================================
    //                  INFO
    // =====================================================

    function version()
        external
        pure
        returns(string memory)
    {
        return "RewardDistributor V1";
    }
}