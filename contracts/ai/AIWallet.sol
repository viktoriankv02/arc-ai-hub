// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AIWallet is Ownable {

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error TransferFailed();

    IERC20 public immutable paymentToken;

    struct Wallet {

        uint256 totalReceived;

        uint256 totalSpent;

        uint256 lockedBalance;

        bool exists;
    }

    mapping(address => Wallet) private wallets;

    event Deposit(
        address indexed user,
        uint256 amount
    );

    event Withdraw(
        address indexed user,
        uint256 amount
    );

    event InternalTransfer(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event Lock(
        address indexed user,
        uint256 amount
    );

    event Unlock(
        address indexed user,
        uint256 amount
    );

    constructor(
        address token,
        address owner
    )
        Ownable(owner)
    {
        if (token == address(0))
            revert ZeroAddress();

        paymentToken = IERC20(token);
    }

    function deposit(
        uint256 amount
    )
        external
    {
        if (amount == 0)
            revert ZeroAmount();

        paymentToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        wallets[msg.sender].exists = true;

        wallets[msg.sender].totalReceived += amount;

        emit Deposit(
            msg.sender,
            amount
        );
    }

    function withdraw(
        uint256 amount
    )
        external
    {
        Wallet storage wallet =
            wallets[msg.sender];

        uint256 available =
            wallet.totalReceived
            -
            wallet.totalSpent
            -
            wallet.lockedBalance;

        if (available < amount)
            revert InsufficientBalance();

        wallet.totalSpent += amount;

        bool ok =
            paymentToken.transfer(
                msg.sender,
                amount
            );

        if (!ok)
            revert TransferFailed();

        emit Withdraw(
            msg.sender,
            amount
        );
    }

    function transferInternal(
        address to,
        uint256 amount
    )
        external
    {
        if (to == address(0))
            revert ZeroAddress();

        Wallet storage sender =
            wallets[msg.sender];

        uint256 available =
            sender.totalReceived
            -
            sender.totalSpent
            -
            sender.lockedBalance;

        if (available < amount)
            revert InsufficientBalance();

        sender.totalSpent += amount;

        wallets[to].exists = true;

        wallets[to].totalReceived += amount;

        emit InternalTransfer(
            msg.sender,
            to,
            amount
        );
    }

    function lock(
        address user,
        uint256 amount
    )
        external
        onlyOwner
    {
        wallets[user].lockedBalance += amount;

        emit Lock(
            user,
            amount
        );
    }

    function unlock(
        address user,
        uint256 amount
    )
        external
        onlyOwner
    {
        Wallet storage wallet =
            wallets[user];

        if (wallet.lockedBalance < amount)
            revert InsufficientBalance();

        wallet.lockedBalance -= amount;

        emit Unlock(
            user,
            amount
        );
    }

    function availableBalance(
        address user
    )
        public
        view
        returns(uint256)
    {
        Wallet memory wallet =
            wallets[user];

        return
            wallet.totalReceived
            -
            wallet.totalSpent
            -
            wallet.lockedBalance;
    }

    function getWallet(
        address user
    )
        external
        view
        returns(
            Wallet memory
        )
    {
        return wallets[user];
    }

}