// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INFTBoostManager
{
    function userBoost(
        address user
    )
        external
        view
        returns(uint16);
}