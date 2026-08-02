// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRewardDistributor {
    function payReward(
        address user,
        uint256 amount,
        string calldata reason
    ) external;
}

contract AAIHQuestManager is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    // =====================================================
    //                    STRUCTS
    // =====================================================

    struct Quest {

        uint256 id;

        string name;

        string description;

        uint256 reward;

        uint32 xp;

        bool active;

        bool repeatable;
    }

    // =====================================================
    //                    STORAGE
    // =====================================================

    uint256 public questCount;

    mapping(uint256 => Quest)
        public quests;

    mapping(address =>
        mapping(uint256 => bool))
        public completed;

    mapping(address => uint256)
        public totalXP;

    IRewardDistributor
        public rewardDistributor;

    // =====================================================
    //                     EVENTS
    // =====================================================

    event QuestCreated(
        uint256 indexed id,
        string name
    );

    event QuestCompleted(
        address indexed user,
        uint256 indexed questId,
        uint256 reward,
        uint256 xp
    );

    event QuestUpdated(
        uint256 indexed questId
    );

    // =====================================================
    //                  CONSTRUCTOR
    // =====================================================

    constructor(
        address rewardDistributorAddress,
        address owner
    )
        Ownable(owner)
    {
        rewardDistributor =
            IRewardDistributor(
                rewardDistributorAddress
            );
    }
        // =====================================================
    //               QUEST MANAGEMENT
    // =====================================================

    function createQuest(
        string calldata name,
        string calldata description,
        uint256 reward,
        uint32 xp,
        bool repeatable
    )
        external
        onlyOwner
    {
        require(
            bytes(name).length > 0,
            "Empty name"
        );

        questCount++;

        quests[questCount] = Quest({

            id: questCount,

            name: name,

            description: description,

            reward: reward,

            xp: xp,

            active: true,

            repeatable: repeatable

        });

        emit QuestCreated(
            questCount,
            name
        );
    }

    function updateQuest(
        uint256 questId,
        string calldata name,
        string calldata description,
        uint256 reward,
        uint32 xp,
        bool active,
        bool repeatable
    )
        external
        onlyOwner
    {
        require(
            questId > 0 &&
            questId <= questCount,
            "Quest not found"
        );

        Quest storage q =
            quests[questId];

        q.name = name;
        q.description = description;
        q.reward = reward;
        q.xp = xp;
        q.active = active;
        q.repeatable = repeatable;

        emit QuestUpdated(
            questId
        );
    }

    function setQuestStatus(
        uint256 questId,
        bool active
    )
        external
        onlyOwner
    {
        require(
            questId > 0 &&
            questId <= questCount,
            "Quest not found"
        );

        quests[questId].active =
            active;

        emit QuestUpdated(
            questId
        );
    }
        // =====================================================
    //               COMPLETE QUEST
    // =====================================================

    function completeQuest(
        uint256 questId
    )
        external
        whenNotPaused
        nonReentrant
    {
        require(
            questId > 0 &&
            questId <= questCount,
            "Quest not found"
        );

        Quest memory q =
            quests[questId];

        require(
            q.active,
            "Quest inactive"
        );

        if(
            !q.repeatable
        ){
            require(
                !completed[msg.sender][questId],
                "Quest already completed"
            );

            completed[msg.sender][questId] = true;
        }

        totalXP[msg.sender] += q.xp;

        if(
            q.reward > 0
        ){
            rewardDistributor.payReward(
                msg.sender,
                q.reward,
                q.name
            );
        }

        emit QuestCompleted(
            msg.sender,
            questId,
            q.reward,
            q.xp
        );
    }

    // =====================================================
    //                  VIEW FUNCTIONS
    // =====================================================

    function hasCompleted(
        address user,
        uint256 questId
    )
        external
        view
        returns(bool)
    {
        return completed[user][questId];
    }

    function userXP(
        address user
    )
        external
        view
        returns(uint256)
    {
        return totalXP[user];
    }

    function getQuest(
        uint256 questId
    )
        external
        view
        returns(Quest memory)
    {
        return quests[questId];
    }
        // =====================================================
    //              ADMIN FUNCTIONS
    // =====================================================

    function setRewardDistributor(
        address distributor
    )
        external
        onlyOwner
    {
        require(
            distributor != address(0),
            "Zero address"
        );

        rewardDistributor =
            IRewardDistributor(
                distributor
            );
    }

    // =====================================================
    //                  PAUSE
    // =====================================================

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
    //                 STATISTICS
    // =====================================================

    function completedQuestCount(
        address user,
        uint256[] calldata questIds
    )
        external
        view
        returns(uint256 total)
    {
        uint256 len =
            questIds.length;

        for(
            uint256 i;
            i < len;
            i++
        ){
            if(
                completed[user][questIds[i]]
            ){
                total++;
            }
        }
    }

    // =====================================================
    //                 INFORMATION
    // =====================================================

    function version()
        external
        pure
        returns(string memory)
    {
        return "AAIH Quest Manager V1";
    }
}
