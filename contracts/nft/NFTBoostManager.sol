// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract NFTBoostManager is
    Ownable2Step,
    Pausable
{
    // =====================================================
    //                      ENUMS
    // =====================================================

    enum NFTType {
        ERC721,
        ERC1155
    }

    enum Category {
        Bronze,
        Silver,
        Gold,
        Diamond,
        Genesis,
        Founder
    }

    // =====================================================
    //                    STRUCTS
    // =====================================================

    struct CollectionInfo {

        bool enabled;

        NFTType nftType;

        Category category;

        uint16 boostPercent;

        uint256 tokenId;

        uint64 expiration;

        string name;
    }

    // =====================================================
    //                     STORAGE
    // =====================================================

    mapping(address => CollectionInfo)
        public collections;

    address[] public collectionList;

    mapping(address => bool)
        public whitelist;

    mapping(address => bool)
        public blacklist;

    uint16 public daoBoost = 100;

    uint16 public eventBoost = 100;

    uint16 public xpBoost = 100;

    uint16 public reputationBoost = 100;

    uint8 public maxNFTBoost = 3;

    // =====================================================
    //                      EVENTS
    // =====================================================

    event CollectionAdded(
        address indexed collection,
        string name,
        uint16 boost
    );

    event CollectionUpdated(
        address indexed collection,
        uint16 boost,
        bool enabled
    );

    event DAOBoostChanged(
        uint16 boost
    );

    event EventBoostChanged(
        uint16 boost
    );

    event XPBoostChanged(
        uint16 boost
    );

    event ReputationBoostChanged(
        uint16 boost
    );

    event WhitelistUpdated(
        address indexed user,
        bool enabled
    );

    event BlacklistUpdated(
        address indexed user,
        bool enabled
    );

    // =====================================================
    //                  CONSTRUCTOR
    // =====================================================

    constructor(
        address owner
    )
        Ownable(owner)
    {

    }
        // =====================================================
    //              COLLECTION MANAGEMENT
    // =====================================================

    function addERC721Collection(
        address collection,
        string calldata name,
        Category category,
        uint16 boost,
        uint64 expiration
    )
        external
        onlyOwner
    {
        require(
            collection != address(0),
            "Zero address"
        );

        require(
            collections[collection].boostPercent == 0,
            "Already exists"
        );

        require(
            boost >= 100,
            "Invalid boost"
        );

        collections[collection] = CollectionInfo({

            enabled: true,

            nftType: NFTType.ERC721,

            category: category,

            boostPercent: boost,

            tokenId: 0,

            expiration: expiration,

            name: name

        });

        collectionList.push(collection);

        emit CollectionAdded(
            collection,
            name,
            boost
        );
    }

    function addERC1155Collection(
        address collection,
        uint256 tokenId,
        string calldata name,
        Category category,
        uint16 boost,
        uint64 expiration
    )
        external
        onlyOwner
    {
        require(
            collection != address(0),
            "Zero address"
        );

        require(
            collections[collection].boostPercent == 0,
            "Already exists"
        );

        require(
            boost >= 100,
            "Invalid boost"
        );

        collections[collection] = CollectionInfo({

            enabled: true,

            nftType: NFTType.ERC1155,

            category: category,

            boostPercent: boost,

            tokenId: tokenId,

            expiration: expiration,

            name: name

        });

        collectionList.push(collection);

        emit CollectionAdded(
            collection,
            name,
            boost
        );
    }

    function updateCollection(
        address collection,
        uint16 boost,
        bool enabled,
        uint64 expiration
    )
        external
        onlyOwner
    {
        require(
            collections[collection].boostPercent > 0,
            "Collection not found"
        );

        collections[collection].boostPercent =
            boost;

        collections[collection].enabled =
            enabled;

        collections[collection].expiration =
            expiration;

        emit CollectionUpdated(
            collection,
            boost,
            enabled
        );
    }

    function removeCollection(
        address collection
    )
        external
        onlyOwner
    {
        require(
            collections[collection].boostPercent > 0,
            "Collection not found"
        );

        delete collections[collection];

        uint256 len =
            collectionList.length;

        for (
            uint256 i;
            i < len;
            i++
        ) {
            if (
                collectionList[i] ==
                collection
            ) {
                collectionList[i] =
                    collectionList[
                        len - 1
                    ];

                collectionList.pop();

                break;
            }
        }
    }
        // =====================================================
    //                  BOOST LOGIC
    // =====================================================

    function hasNFT(
        address user,
        address collection
    )
        public
        view
        returns(bool)
    {
        CollectionInfo memory c =
            collections[collection];

        if(!c.enabled){
            return false;
        }

        if(
            c.expiration != 0 &&
            block.timestamp >
            c.expiration
        ){
            return false;
        }

        if(
            c.nftType ==
            NFTType.ERC721
        ){
            return
                IERC721(collection)
                    .balanceOf(user) > 0;
        }

        return
            IERC1155(collection)
                .balanceOf(
                    user,
                    c.tokenId
                ) > 0;
    }

    function userBoost(
        address user
    )
        public
        view
        returns(uint16)
    {
        if(
            blacklist[user]
        ){
            return 100;
        }

        uint16 best = 100;

        uint256 used;

        uint256 len =
            collectionList.length;

        for(
            uint256 i;
            i < len;
            i++
        ){

            if(
                used >=
                maxNFTBoost
            ){
                break;
            }

            address col =
                collectionList[i];

            if(
                hasNFT(
                    user,
                    col
                )
            ){

                used++;

                uint16 boost =
                    collections[col]
                        .boostPercent;

                if(
                    boost >
                    best
                ){
                    best = boost;
                }
            }
        }

        if(
            whitelist[user]
        ){
            best =
                uint16(
                    uint256(best) *
                    daoBoost /
                    100
                );
        }

        best =
            uint16(
                uint256(best) *
                eventBoost /
                100
            );

        best =
            uint16(
                uint256(best) *
                xpBoost /
                100
            );

        best =
            uint16(
                uint256(best) *
                reputationBoost /
                100
            );

        return best;
    }

    // =====================================================
    //              BOOST SETTINGS
    // =====================================================

    function setDAOBoost(
        uint16 boost
    )
        external
        onlyOwner
    {
        require(
            boost >= 100,
            "Invalid boost"
        );

        daoBoost = boost;

        emit DAOBoostChanged(
            boost
        );
    }

    function setEventBoost(
        uint16 boost
    )
        external
        onlyOwner
    {
        require(
            boost >= 100,
            "Invalid boost"
        );

        eventBoost = boost;

        emit EventBoostChanged(
            boost
        );
    }

    function setXPBoost(
        uint16 boost
    )
        external
        onlyOwner
    {
        require(
            boost >= 100,
            "Invalid boost"
        );

        xpBoost = boost;

        emit XPBoostChanged(
            boost
        );
    }

    function setReputationBoost(
        uint16 boost
    )
        external
        onlyOwner
    {
        require(
            boost >= 100,
            "Invalid boost"
        );

        reputationBoost = boost;

        emit ReputationBoostChanged(
            boost
        );
    }

    function setMaxNFTBoost(
        uint8 value
    )
        external
        onlyOwner
    {
        require(
            value > 0,
            "Invalid value"
        );

        maxNFTBoost = value;
    }

    function setWhitelist(
        address user,
        bool enabled
    )
        external
        onlyOwner
    {
        whitelist[user] =
            enabled;

        emit WhitelistUpdated(
            user,
            enabled
        );
    }

    function setBlacklist(
        address user,
        bool enabled
    )
        external
        onlyOwner
    {
        blacklist[user] =
            enabled;

        emit BlacklistUpdated(
            user,
            enabled
        );
    }
        // =====================================================
    //                    STATISTICS
    // =====================================================

    function collectionCount()
        external
        view
        returns(uint256)
    {
        return collectionList.length;
    }

    function getCollection(
        uint256 index
    )
        external
        view
        returns(
            address,
            CollectionInfo memory
        )
    {
        require(
            index < collectionList.length,
            "Index out of bounds"
        );

        address collection =
            collectionList[index];

        return (
            collection,
            collections[collection]
        );
    }

    // =====================================================
    //                  ADMIN
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
    //                 INFORMATION
    // =====================================================

    function version()
        external
        pure
        returns(string memory)
    {
        return "NFTBoostManager V3";
    }
}