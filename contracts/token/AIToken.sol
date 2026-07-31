// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AIToken is ERC20, Ownable {

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor(address initialOwner)
        ERC20("Arc AI Hub Token", "AIH")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 10_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount)
        external
        onlyOwner
    {
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "Max supply exceeded"
        );

        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}