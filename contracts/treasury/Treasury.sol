// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Treasury is Ownable2Step, ReentrancyGuard {

    event ETHDeposited(address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);

    event TokenDeposited(
        address indexed token,
        address indexed from,
        uint256 amount
    );

    event TokenWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    address public stakingContract;

    constructor(address initialOwner)
        Ownable(initialOwner)
    {}

    function setStakingContract(address _staking)
        external
        onlyOwner
    {
        stakingContract = _staking;
    }

    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }

    function depositToken(
        address token,
        uint256 amount
    )
        external
        nonReentrant
    {
        IERC20(token).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        emit TokenDeposited(
            token,
            msg.sender,
            amount
        );
    }

    function withdrawETH(
        address payable to,
        uint256 amount
    )
        external
        onlyOwner
        nonReentrant
    {
        require(
            address(this).balance >= amount,
            "Insufficient ETH"
        );

        (bool success,) = to.call{value: amount}("");

        require(success, "Transfer failed");

        emit ETHWithdrawn(to, amount);
    }

    function withdrawToken(
    address token,
    address to,
    uint256 amount
)
    external
    nonReentrant
{
    require(
        msg.sender == owner() ||
        msg.sender == stakingContract,
        "Unauthorized"
    );
        IERC20(token).transfer(
            to,
            amount
        );

        emit TokenWithdrawn(
            token,
            to,
            amount
        );
    }

    function tokenBalance(address token)
        external
        view
        returns(uint256)
    {
        return IERC20(token).balanceOf(address(this));
    }

    function ethBalance()
        external
        view
        returns(uint256)
    {
        return address(this).balance;
    }
}