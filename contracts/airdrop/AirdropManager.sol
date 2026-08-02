// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AirdropManager is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    IERC20 public immutable token;

    mapping(address => bool)
        public operators;

    mapping(address => uint256)
        public allocations;

    mapping(address => bool)
        public claimed;

    uint256 public totalAllocated;
    uint256 public totalClaimed;
    uint256 public totalUsers;

    event OperatorUpdated(
        address indexed operator,
        bool enabled
    );

    event AllocationAdded(
        address indexed user,
        uint256 amount
    );

    event AllocationRemoved(
        address indexed user
    );

    event Claimed(
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

    function deposit(
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

    function addAllocation(
        address user,
        uint256 amount
    )
        external
        onlyOperator
    {
        require(
            amount > 0,
            "Zero amount"
        );

        if (allocations[user] == 0)
            totalUsers++;

        totalAllocated -= allocations[user];

        allocations[user] = amount;

        totalAllocated += amount;

        claimed[user] = false;

        emit AllocationAdded(
            user,
            amount
        );
    }

    function batchAllocation(
        address[] calldata users,
        uint256[] calldata amounts
    )
        external
        onlyOperator
    {
        require(
            users.length == amounts.length,
            "Length mismatch"
        );

        for(uint256 i=0;i<users.length;i++){

            if(amounts[i]==0)
                continue;

            if(allocations[users[i]]==0)
                totalUsers++;

            totalAllocated -=
                allocations[users[i]];

            allocations[users[i]] =
                amounts[i];

            totalAllocated +=
                amounts[i];

            claimed[users[i]] = false;

            emit AllocationAdded(
                users[i],
                amounts[i]
            );
        }
    }

    function removeAllocation(
        address user
    )
        external
        onlyOperator
    {
        totalAllocated -= allocations[user];

        allocations[user] = 0;

        claimed[user] = false;

        emit AllocationRemoved(
            user
        );
    }

    function claim()
        external
        whenNotPaused
        nonReentrant
    {
        require(
            !claimed[msg.sender],
            "Already claimed"
        );

        uint256 amount =
            allocations[msg.sender];

        require(
            amount > 0,
            "Nothing to claim"
        );

        claimed[msg.sender] = true;

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

        emit Claimed(
            msg.sender,
            amount
        );
    }

    function emergencyWithdraw(
        uint256 amount
    )
        external
        onlyOwner
    {
        bool ok =
            token.transfer(
                owner(),
                amount
            );

        require(
            ok,
            "Transfer failed"
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
        return "AirdropManager V2";
    }
}