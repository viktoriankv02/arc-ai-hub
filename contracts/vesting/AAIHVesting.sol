// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AAIHVesting is
    Ownable2Step,
    ReentrancyGuard
{
    IERC20 public immutable token;

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool revocable;
        bool revoked;
    }

    uint256 public vestingCount;

    mapping(uint256 => VestingSchedule)
        public vestings;

    event VestingCreated(
        uint256 indexed id,
        address indexed beneficiary,
        uint256 amount
    );

    event TokensReleased(
        uint256 indexed id,
        uint256 amount
    );

    event VestingRevoked(
        uint256 indexed id
    );

    constructor(
        address tokenAddress,
        address owner
    )
        Ownable(owner)
    {
        token = IERC20(tokenAddress);
    }
    // ======================================================
//              CREATE VESTING
// ======================================================

function createVesting(
    address beneficiary,
    uint256 amount,
    uint64 start,
    uint64 cliff,
    uint64 duration,
    bool revocable
)
    external
    onlyOwner
{
    require(
        beneficiary != address(0),
        "Zero beneficiary"
    );

    require(
        amount > 0,
        "Zero amount"
    );

    require(
        duration > 0,
        "Zero duration"
    );

    vestingCount++;

    vestings[vestingCount] = VestingSchedule({

        beneficiary: beneficiary,

        totalAmount: amount,

        released: 0,

        start: start,

        cliff: cliff,

        duration: duration,

        revocable: revocable,

        revoked: false

    });

    emit VestingCreated(

        vestingCount,

        beneficiary,

        amount

    );
}

// ======================================================
//            VESTED AMOUNT
// ======================================================

function vestedAmount(
    uint256 id
)
    public
    view
    returns(uint256)
{
    VestingSchedule memory v =
        vestings[id];

    if(v.revoked)
        return v.released;

    if(block.timestamp < v.start + v.cliff)
        return 0;

    if(block.timestamp >= v.start + v.duration)
        return v.totalAmount;

    uint256 elapsed =
        block.timestamp -
        v.start;

    return
        v.totalAmount *
        elapsed /
        v.duration;
}

// ======================================================
//          RELEASABLE AMOUNT
// ======================================================

function releasableAmount(
    uint256 id
)
    public
    view
    returns(uint256)
{
    VestingSchedule memory v =
        vestings[id];

    return
        vestedAmount(id) -
        v.released;
}
// ======================================================
//                 RELEASE TOKENS
// ======================================================

function release(
    uint256 id
)
    external
    nonReentrant
{
    VestingSchedule storage v =
        vestings[id];

    require(
        !v.revoked,
        "Revoked"
    );

    require(
        msg.sender ==
        v.beneficiary,
        "Not beneficiary"
    );

    uint256 amount =
        releasableAmount(id);

    require(
        amount > 0,
        "Nothing to release"
    );

    v.released += amount;

    bool ok =
        token.transfer(
            v.beneficiary,
            amount
        );

    require(
        ok,
        "Transfer failed"
    );

    emit TokensReleased(
        id,
        amount
    );
}

// ======================================================
//                 REVOKE VESTING
// ======================================================

function revoke(
    uint256 id
)
    external
    onlyOwner
{
    VestingSchedule storage v =
        vestings[id];

    require(
        v.revocable,
        "Not revocable"
    );

    require(
        !v.revoked,
        "Already revoked"
    );

    v.revoked = true;

    emit VestingRevoked(id);
}

// ======================================================
//                  VIEW HELPERS
// ======================================================

function getVesting(
    uint256 id
)
    external
    view
    returns(VestingSchedule memory)
{
    return vestings[id];
}

function beneficiaryVestings(
    address beneficiary
)
    external
    view
    returns(uint256[] memory ids)
{
    uint256 count;

    for(uint256 i = 1; i <= vestingCount; i++){

        if(
            vestings[i].beneficiary ==
            beneficiary
        ){
            count++;
        }
    }

    ids = new uint256[](count);

    uint256 index;

    for(uint256 i = 1; i <= vestingCount; i++){

        if(
            vestings[i].beneficiary ==
            beneficiary
        ){
            ids[index] = i;
            index++;
        }
    }
}

// ======================================================
//                    CONTRACT INFO
// ======================================================

function version()
    external
    pure
    returns(string memory)
{
    return "AAIH Vesting V1";
}
// End of contract
}