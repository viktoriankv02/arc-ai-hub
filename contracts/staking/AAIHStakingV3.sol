// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ITreasury.sol";
import "../interfaces/INFTBoostManager.sol";
import "../errors/StakingErrors.sol";

contract AAIHStakingV3 is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    IERC20 public immutable token;
    ITreasury public immutable treasury;

    INFTBoostManager public nftBoost;

    uint16 public constant PENALTY_PERCENT = 10;

    uint256 public totalStaked;

    bool public daoEnabled;

    struct Pool {

        uint32 lockDays;

        uint16 apy;

        bool active;

        bool flexible;

    }

    struct Position {

        uint256 amount;

        uint64 startTime;

        uint64 unlockTime;

        uint16 poolId;

        bool withdrawn;

    }

    mapping(uint16 => Pool)
        public pools;

    mapping(address => Position[])
        internal positions;

    mapping(address => address)
        public referrer;

    event PoolCreated(

        uint16 indexed id,

        uint32 lockDays,

        uint16 apy,

        bool flexible

    );

    event PoolUpdated(

        uint16 indexed id

    );

    event Staked(

        address indexed user,

        uint16 indexed pool,

        uint256 amount

    );

    event Withdrawn(

        address indexed user,

        uint256 amount,

        uint256 reward

    );

    event EarlyWithdraw(

        address indexed user,

        uint256 returnedAmount,

        uint256 penalty

    );

    event EmergencyWithdraw(

        address indexed user,

        uint256 amount

    );

    event ReferrerRegistered(

        address indexed user,

        address indexed referrer

    );

    constructor(

        address tokenAddress,

        address treasuryAddress,

        address owner

    )
        Ownable(owner)
    {

        token =
            IERC20(
                tokenAddress
            );

        treasury =
            ITreasury(
                treasuryAddress
            );

        nftBoost =
            INFTBoostManager(
                address(0)
            );

        pools[1] =
            Pool(
                30,
                8,
                true,
                false
            );

        pools[2] =
            Pool(
                90,
                12,
                true,
                false
            );

        pools[3] =
            Pool(
                180,
                18,
                true,
                false
            );

        pools[4] =
            Pool(
                365,
                25,
                true,
                false
            );

        pools[5] =
            Pool(
                0,
                5,
                true,
                true
            );
    }

    function setNFTBoostManager(

        address manager

    )
        external
        onlyOwner
    {

        nftBoost =
            INFTBoostManager(
                manager
            );

    }

    // =====================================================
    //                     STAKE
    // =====================================================

    function stake(

        uint16 poolId,

        uint256 amount

    )
        external
        whenNotPaused
        nonReentrant
    {

        if(amount == 0)
            revert AmountZero();

        Pool memory pool =
            pools[poolId];

        if(!pool.active)
            revert PoolInactive();

        bool ok =
            token.transferFrom(
                msg.sender,
                address(this),
                amount
            );

        if(!ok)
            revert TransferFailed();

        uint64 unlockTime;

        if(pool.flexible){

            unlockTime =
                uint64(
                    block.timestamp
                );

        } else {

            unlockTime =
                uint64(
                    block.timestamp +
                    uint64(pool.lockDays) *
                    1 days
                );

        }

        positions[msg.sender].push(

            Position({

                amount: amount,

                startTime:
                    uint64(
                        block.timestamp
                    ),

                unlockTime:
                    unlockTime,

                poolId:
                    poolId,

                withdrawn:
                    false

            })

        );

        totalStaked += amount;

        emit Staked(

            msg.sender,

            poolId,

            amount

        );
    }
        // =====================================================
    //                  REWARD
    // =====================================================

    function calculateReward(
        address user,
        uint256 index
    )
        public
        view
        returns (uint256)
    {
        Position memory p =
            positions[user][index];

        Pool memory pool =
            pools[p.poolId];

        if (pool.flexible) {

            uint256 stakingDays =
                (block.timestamp -
                p.startTime) /
                1 days;

            return
                p.amount *
                pool.apy *
                stakingDays /
                36500;
        }

        return
            p.amount *
            pool.apy *
            pool.lockDays /
            36500;
    }

    function calculateRewardWithBoost(
        address user,
        uint256 index
    )
        public
        view
        returns (uint256)
    {
        uint256 reward =
            calculateReward(
                user,
                index
            );

        if (
            address(nftBoost) ==
            address(0)
        ) {
            return reward;
        }

        uint16 boost =
            nftBoost.userBoost(
                user
            );

        return
            reward *
            boost /
            100;
    }

    // =====================================================
    //                 WITHDRAW
    // =====================================================

    function withdraw(
        uint256 index
    )
        external
        nonReentrant
    {
        Position storage p =
            positions[msg.sender][index];

        if (p.withdrawn)
            revert AlreadyWithdrawn();

        Pool memory pool =
            pools[p.poolId];

        if (
            !pool.flexible &&
            block.timestamp <
            p.unlockTime
        ) {
            revert StakeLocked();
        }

        uint256 reward =
            calculateRewardWithBoost(
                msg.sender,
                index
            );

        p.withdrawn = true;

        totalStaked -=
            p.amount;

        bool ok =
            token.transfer(
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

    // =====================================================
    //             EARLY WITHDRAW
    // =====================================================

    function earlyWithdraw(
        uint256 index
    )
        external
        nonReentrant
    {
        Position storage p =
            positions[msg.sender][index];

        if (p.withdrawn)
            revert AlreadyWithdrawn();

        Pool memory pool =
            pools[p.poolId];

        if (pool.flexible)
            revert PoolInactive();

        if (
            block.timestamp >=
            p.unlockTime
        )
            revert StakeLocked();

        p.withdrawn = true;

        totalStaked -=
            p.amount;

        uint256 penalty =
            p.amount *
            PENALTY_PERCENT /
            100;

        uint256 returned =
            p.amount -
            penalty;

        bool ok =
            token.transfer(
                msg.sender,
                returned
            );

        if (!ok)
            revert TransferFailed();

        ok =
            token.transfer(
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

    // =====================================================
    //          EMERGENCY WITHDRAW
    // =====================================================

    function emergencyWithdraw(
        uint256 index
    )
        external
        nonReentrant
    {
        Position storage p =
            positions[msg.sender][index];

        if (p.withdrawn)
            revert AlreadyWithdrawn();

        p.withdrawn = true;

        totalStaked -=
            p.amount;

        bool ok =
            token.transfer(
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
        // =====================================================
    //               POOL MANAGEMENT
    // =====================================================

    function createPool(
        uint16 id,
        uint32 lockDays,
        uint16 apy,
        bool flexible
    )
        external
        onlyOwner
    {
        if (pools[id].apy != 0)
            revert();

        pools[id] = Pool({
            lockDays: lockDays,
            apy: apy,
            active: true,
            flexible: flexible
        });

        emit PoolCreated(
            id,
            lockDays,
            apy,
            flexible
        );
    }

    function updatePool(
        uint16 id,
        uint32 lockDays,
        uint16 apy,
        bool active,
        bool flexible
    )
        external
        onlyOwner
    {
        Pool storage pool =
            pools[id];

        if (pool.apy == 0)
            revert();

        pool.lockDays = lockDays;
        pool.apy = apy;
        pool.active = active;
        pool.flexible = flexible;

        emit PoolUpdated(id);
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

    // =====================================================
    //                 VIEW FUNCTIONS
    // =====================================================

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
        returns(Position memory)
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
        uint256 len =
            positions[user].length;

        for(
            uint256 i;
            i < len;
            i++
        ){
            if(
                !positions[user][i]
                    .withdrawn
            ){
                total +=
                    positions[user][i]
                        .amount;
            }
        }
    }

    // =====================================================
    //                    DAO
    // =====================================================

    function enableDAO()
        external
        onlyOwner
    {
        daoEnabled = true;
    }

    // =====================================================
    //              AUTO COMPOUND
    // =====================================================

    function canCompound(
        address user,
        uint256 index
    )
        external
        view
        returns(bool)
    {
        Position memory p =
            positions[user][index];

        return
            !p.withdrawn &&
            block.timestamp >=
            p.unlockTime;
    }

    // =====================================================
    //                 NFT BOOST
    // =====================================================

    function rewardMultiplier(
        address user
    )
        public
        view
        returns(uint256)
    {
        if(
            address(nftBoost) ==
            address(0)
        ){
            return 100;
        }

        return
            nftBoost.userBoost(
                user
            );
    }

    // =====================================================
    //                 REFERRALS
    // =====================================================

    function registerReferrer(
        address ref
    )
        external
    {
        if(
            ref ==
            msg.sender
        )
            revert();

        if(
            referrer[msg.sender] !=
            address(0)
        )
            revert();

        referrer[msg.sender] = ref;

        emit ReferrerRegistered(
            msg.sender,
            ref
        );
    }

    // =====================================================
    //                 VERSION
    // =====================================================

    function version()
        external
        pure
        returns(string memory)
    {
        return
            "AAIH Staking V3";
    }
}