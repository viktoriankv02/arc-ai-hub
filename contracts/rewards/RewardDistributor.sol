// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardDistributor is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    IERC20 public immutable token;

    mapping(address => bool)
        public operators;

    mapping(address => uint256)
        public totalRewards;

    mapping(address => uint256)
        public claimedRewards;

    mapping(address => uint256)
        public pendingRewards;

    uint256 public totalPending;
    uint256 public totalClaimed;

    event OperatorUpdated(
        address indexed operator,
        bool enabled
    );

    event RewardPaid(
        address indexed user,
        uint256 amount,
        string reason
    );

    event RewardQueued(
        address indexed user,
        uint256 amount,
        string reason
    );

    event RewardClaimed(
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

    modifier onlyOperator()
    {
        require(
            operators[msg.sender] ||
            msg.sender == owner(),
            "Not operator"
        );
        _;
    }

    function setOperator(
        address operator,
        bool enabled
    )
        external
        onlyOwner
    {
        operators[operator] = enabled;

        emit OperatorUpdated(
            operator,
            enabled
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

    function fund(
        uint256 amount
    )
        external
    {
        bool ok =
            token.transferFrom(
                msg.sender,
                address(this),
                amount
            );

        require(
            ok,
            "Transfer failed"
        );
    }

    function payReward(
        address user,
        uint256 amount,
        string calldata reason
    )
        external
        onlyOperator
        whenNotPaused
        nonReentrant
    {
        require(
            amount > 0,
            "Zero amount"
        );

        bool ok =
            token.transfer(
                user,
                amount
            );

        require(
            ok,
            "Transfer failed"
        );

        totalRewards[user] += amount;
        claimedRewards[user] += amount;
        totalClaimed += amount;

        emit RewardPaid(
            user,
            amount,
            reason
        );
    }

    function queueReward(
        address user,
        uint256 amount,
        string calldata reason
    )
        external
        onlyOperator
        whenNotPaused
    {
        require(
            amount > 0,
            "Zero amount"
        );

        pendingRewards[user] += amount;
        totalPending += amount;

        emit RewardQueued(
            user,
            amount,
            reason
        );
    }

    function claimReward()
        external
        whenNotPaused
        nonReentrant
    {
        uint256 amount =
            pendingRewards[msg.sender];

        require(
            amount > 0,
            "Nothing to claim"
        );

        pendingRewards[msg.sender] = 0;

        totalPending -= amount;

        totalRewards[msg.sender] += amount;
        claimedRewards[msg.sender] += amount;
        totalClaimed += amount;

        bool ok =
            token.transfer(
                msg.sender,
                amount
            );

        require(
            ok,
            "Transfer failed"
        );

        emit RewardClaimed(
            msg.sender,
            amount
        );
    }

    function contractBalance()
        external
        view
        returns(uint256)
    {
        return token.balanceOf(
            address(this)
        );
    }

    function version()
        external
        pure
        returns(string memory)
    {
        return "RewardDistributor V2";
    }
}