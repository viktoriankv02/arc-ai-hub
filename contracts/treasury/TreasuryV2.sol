// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryV2 is AccessControl, ReentrancyGuard {

    bytes32 public constant TREASURY_MANAGER_ROLE =
        keccak256("TREASURY_MANAGER_ROLE");

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

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    function depositToken(
    address token,
    uint256 amount
)
    external
{
    bool ok = IERC20(token).transferFrom(
        msg.sender,
        address(this),
        amount
    );

    require(ok, "Transfer failed");

    emit TokenDeposited(
        token,
        msg.sender,
        amount
    );
}
function withdrawToken(
    address token,
    address to,
    uint256 amount
)
    external
    onlyRole(TREASURY_MANAGER_ROLE)
    nonReentrant
{
    bool ok = IERC20(token).transfer(
        to,
        amount
    );

    require(ok, "Transfer failed");

    emit TokenWithdrawn(
        token,
        to,
        amount
    );
}
function tokenBalance(
    address token
)
    external
    view
    returns(uint256)
{
    return IERC20(token).balanceOf(address(this));
}
function grantTreasuryManager(
    address account
)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    grantRole(
        TREASURY_MANAGER_ROLE,
        account
    );
}
function revokeTreasuryManager(
    address account
)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    revokeRole(
        TREASURY_MANAGER_ROLE,
        account
    );
}
}
