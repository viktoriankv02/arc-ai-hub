// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITreasury {

    function withdrawToken(
        address token,
        address to,
        uint256 amount
    ) external;

    function tokenBalance(
        address token
    ) external view returns(uint256);

}