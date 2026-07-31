// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

contract AAIHToken is
    ERC20,
    ERC20Burnable,
    ERC20Permit,
    ERC20Votes,
    Pausable,
    Ownable2Step,
    AccessControl
{
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(address owner)
        ERC20("Arc AI Hub", "AAIH")
        ERC20Permit("Arc AI Hub")
        Ownable(owner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MINTER_ROLE, owner);
        _grantRole(PAUSER_ROLE, owner);

        _mint(owner, 100_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }

    function pause()
        external
        onlyRole(PAUSER_ROLE)
    {
        _pause();
    }

    function unpause()
        external
        onlyRole(PAUSER_ROLE)
    {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
        whenNotPaused
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
    public
    view
    override(ERC20Permit, Nonces)
    returns (uint256)
    {
    return super.nonces(owner);
 }
}