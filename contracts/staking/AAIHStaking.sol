// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AAIHStaking is
    Ownable2Step,
    ReentrancyGuard,
    Pausable
{
    IERC20 public immutable token;

    struct StakeInfo {
        uint256 amount;
        uint256 reward;
        uint256 startTime;
        uint256 unlockTime;
        uint256 apy;
        bool claimed;
    }

    mapping(address => StakeInfo[]) public stakes;

    event Staked(
        address indexed user,
        uint256 amount,
        uint256 apy,
        uint256 unlockTime
    );

    event Withdrawn(
        address indexed user,
        uint256 amount,
        uint256 reward
    );

    constructor(
        address tokenAddress,
        address owner
    )
        Ownable(owner)
    {
        token = IERC20(tokenAddress);
    }

    function stake(
        uint256 amount,
        uint256 lockDays
    )
        external
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount = 0");

        uint256 apy;

        if(lockDays == 30){

            apy = 8;

        }else if(lockDays == 90){

            apy = 12;

        }else if(lockDays == 180){

            apy = 18;

        }else if(lockDays == 365){

            apy = 25;

        }else{

            revert("Invalid lock period");

        }

        token.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        uint256 reward =
            amount *
            apy *
            lockDays /
            36500;

        stakes[msg.sender].push(

            StakeInfo({

                amount: amount,
                reward: reward,
                startTime: block.timestamp,
                unlockTime: block.timestamp + lockDays * 1 days,
                apy: apy,
                claimed: false

            })

        );

        emit Staked(
            msg.sender,
            amount,
            apy,
            block.timestamp + lockDays * 1 days
        );
    }

    function withdraw(
        uint256 index
    )
        external
        nonReentrant
    {
        StakeInfo storage s = stakes[msg.sender][index];

        require(!s.claimed, "Already claimed");

        require(
            block.timestamp >= s.unlockTime,
            "Still locked"
        );

        s.claimed = true;

        token.transfer(
            msg.sender,
            s.amount + s.reward
        );

        emit Withdrawn(
            msg.sender,
            s.amount,
            s.reward
        );
    }

    function pause()
        external
        onlyOwner
    {
        _pause();
    }

    function unpause()
        external
        onlyOwner
    {
        _unpause();
    }

    function getStakeCount(address user)
        external
        view
        returns(uint256)
    {
        return stakes[user].length;
    }
}