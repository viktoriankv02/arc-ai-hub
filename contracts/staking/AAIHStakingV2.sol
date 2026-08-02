// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ITreasury.sol";
import "../errors/StakingErrors.sol";
import "./StakingTypes.sol";

contract AAIHStakingV2 is
    Ownable2Step,
    ReentrancyGuard,
    Pausable
{
    IERC20 public immutable token;
    ITreasury public immutable treasury;

    uint16 public constant PENALTY_PERCENT = 10;

    mapping(address => StakePosition[]) internal positions;
    mapping(uint16 => PoolInfo) public pools;

    event PoolCreated(
        uint16 indexed id,
        uint32 lockDays,
        uint16 apy
    );

    event PoolUpdated(
        uint16 indexed id,
        uint16 apy,
        bool active
    );

    event Staked(
        address indexed user,
        uint256 amount,
        uint16 indexed pool
    );

    event Withdrawn(
        address indexed user,
        uint256 amount,
        uint256 reward
    );

    event EmergencyWithdraw(
        address indexed user,
        uint256 amount
    );

    event EarlyWithdraw(
        address indexed user,
        uint256 returnedAmount,
        uint256 penalty
    );

    constructor(
        address tokenAddress,
        address treasuryAddress,
        address owner
    )
        Ownable(owner)
    {
        token = IERC20(tokenAddress);
        treasury = ITreasury(treasuryAddress);

        pools[1] = PoolInfo({
            apy: 8,
            lockDays: 30,
            active: true
        });

        pools[2] = PoolInfo({
            apy: 12,
            lockDays: 90,
            active: true
        });

        pools[3] = PoolInfo({
            apy: 18,
            lockDays: 180,
            active: true
        });

        pools[4] = PoolInfo({
            apy: 25,
            lockDays: 365,
            active: true
        });
    }
    function stake(
    uint16 poolId,
    uint256 amount
)
    external
    whenNotPaused
    nonReentrant
{
    if (amount == 0)
        revert AmountZero();

    PoolInfo memory pool = pools[poolId];

    if (!pool.active)
        revert PoolInactive();

    bool ok = token.transferFrom(
        msg.sender,
        address(this),
        amount
    );

    if (!ok)
        revert TransferFailed();

    positions[msg.sender].push(
        StakePosition({
            amount: amount,
            startTime: uint64(block.timestamp),
            unlockTime: uint64(
                block.timestamp +
                pool.lockDays *
                1 days
            ),
            poolId: poolId,
            withdrawn: false
        })
    );

    emit Staked(
        msg.sender,
        amount,
        poolId
    );
}

function calculateReward(
    address user,
    uint256 index
)
    public
    view
    returns (uint256)
{
    StakePosition memory p =
        positions[user][index];

    PoolInfo memory pool =
        pools[p.poolId];

    return
        p.amount *
        pool.apy *
        pool.lockDays /
        36500;
}

function withdraw(
    uint256 index
)
    external
    nonReentrant
{
    StakePosition storage p =
        positions[msg.sender][index];

    if (p.withdrawn)
        revert AlreadyWithdrawn();

    if (block.timestamp < p.unlockTime)
        revert StakeLocked();

    uint256 reward =
        calculateReward(
            msg.sender,
            index
        );

    p.withdrawn = true;

    bool ok = token.transfer(
        msg.sender,
        p.amount
    );

    if (!ok)
        revert TransferFailed();

    treasury.withdrawToken(
        address(token),
        msg.sender,
        reward
    );

    emit Withdrawn(
        msg.sender,
        p.amount,
        reward
    );
}

function emergencyWithdraw(
    uint256 index
)
    external
    nonReentrant
{
    StakePosition storage p =
        positions[msg.sender][index];

    if (p.withdrawn)
        revert AlreadyWithdrawn();

    p.withdrawn = true;

    bool ok = token.transfer(
        msg.sender,
        p.amount
    );

    if (!ok)
        revert TransferFailed();

    emit EmergencyWithdraw(
        msg.sender,
        p.amount
    );
}

function earlyWithdraw(
    uint256 index
)
    external
    nonReentrant
{
    StakePosition storage p =
        positions[msg.sender][index];

    if (p.withdrawn)
        revert AlreadyWithdrawn();

    if (block.timestamp >= p.unlockTime)
        revert();

    p.withdrawn = true;

    uint256 penalty =
        p.amount *
        PENALTY_PERCENT /
        100;

    uint256 returned =
        p.amount -
        penalty;

    bool ok = token.transfer(
        msg.sender,
        returned
    );

    if (!ok)
        revert TransferFailed();

    ok = token.transfer(
        address(treasury),
        penalty
    );

    if (!ok)
        revert TransferFailed();

    emit EarlyWithdraw(
        msg.sender,
        returned,
        penalty
    );
}
function createPool(
    uint16 id,
    uint32 lockDays,
    uint16 apy
)
    external
    onlyOwner
{
    if (pools[id].lockDays != 0)
        revert();

    pools[id] = PoolInfo({
        apy: apy,
        lockDays: lockDays,
        active: true
    });

    emit PoolCreated(
        id,
        lockDays,
        apy
    );
}

function updatePool(
    uint16 id,
    uint32 lockDays,
    uint16 apy,
    bool active
)
    external
    onlyOwner
{
    PoolInfo storage pool = pools[id];

    if (pool.lockDays == 0)
        revert();

    pool.lockDays = lockDays;
    pool.apy = apy;
    pool.active = active;

    emit PoolUpdated(
        id,
        apy,
        active
    );
}

function setPoolActive(
    uint16 id,
    bool active
)
    external
    onlyOwner
{
    pools[id].active = active;

    emit PoolUpdated(
        id,
        pools[id].apy,
        active
    );
}

function updateAPY(
    uint16 id,
    uint16 apy
)
    external
    onlyOwner
{
    pools[id].apy = apy;

    emit PoolUpdated(
        id,
        apy,
        pools[id].active
    );
}

function getPool(
    uint16 id
)
    external
    view
    returns (PoolInfo memory)
{
    return pools[id];
}

function getPools()
    external
    view
    returns (PoolInfo[4] memory result)
{
    result[0] = pools[1];
    result[1] = pools[2];
    result[2] = pools[3];
    result[3] = pools[4];
}

function stakeCount(
    address user
)
    external
    view
    returns(uint256)
{
    return positions[user].length;
}

function getStake(
    address user,
    uint256 index
)
    external
    view
    returns(StakePosition memory)
{
    return positions[user][index];
}

function totalUserStaked(
    address user
)
    external
    view
    returns(uint256 total)
{
    uint256 len = positions[user].length;

    for(uint256 i = 0; i < len; i++){

        if(!positions[user][i].withdrawn){

            total += positions[user][i].amount;

        }
    }
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
// ======================================================
//                 DAO READY
// ======================================================

/// @notice Reserved for future DAO governance.
/// DAO will be able to manage pools instead of owner.
bool public daoEnabled;

/// @notice Enables DAO management.
function enableDAO()
    external
    onlyOwner
{
    daoEnabled = true;
}

// ======================================================
//             FUTURE AUTO COMPOUND
// ======================================================

/// @notice Placeholder for V3 auto compound.
function canCompound(
    address user,
    uint256 index
)
    public
    view
    returns(bool)
{
    StakePosition memory p =
        positions[user][index];

    return
        !p.withdrawn &&
        block.timestamp >= p.unlockTime;
}

// ======================================================
//              FUTURE NFT BOOST
// ======================================================

/// @notice Returns NFT reward multiplier.
/// Currently disabled.
function rewardMultiplier(
    address
)
    public
    pure
    returns(uint256)
{
    return 100;
}

// ======================================================
//              FUTURE REFERRALS
// ======================================================

mapping(address => address)
    public referrer;

event ReferrerRegistered(
    address indexed user,
    address indexed ref
);

function registerReferrer(
    address ref
)
    external
{
    require(
        ref != msg.sender,
        "Self referral"
    );

    require(
        referrer[msg.sender] == address(0),
        "Already registered"
    );

    referrer[msg.sender] = ref;

    emit ReferrerRegistered(
        msg.sender,
        ref
    );
}

// ======================================================
//                 CONTRACT INFO
// ======================================================

function version()
    external
    pure
    returns(string memory)
{
    return "AAIH Staking V2.1";
}

}