// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClaimEngine is
    Ownable2Step,
    ReentrancyGuard
{
    IERC20 public immutable token;

    bytes32 public merkleRoot;

    mapping(address => bool)
        public claimed;

    event MerkleRootUpdated(
        bytes32 root
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

    function setMerkleRoot(
        bytes32 root
    )
        external
        onlyOwner
    {
        merkleRoot = root;

        emit MerkleRootUpdated(
            root
        );
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

    function claim(
        uint256 amount,
        bytes32[] calldata proof
    )
        external
        nonReentrant
    {
        require(
            !claimed[msg.sender],
            "Already claimed"
        );

        bytes32 leaf =
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    amount
                )
            );

        require(
            MerkleProof.verify(
                proof,
                merkleRoot,
                leaf
            ),
            "Invalid proof"
        );

        claimed[msg.sender] = true;

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
        return "Claim Engine V1";
    }
}