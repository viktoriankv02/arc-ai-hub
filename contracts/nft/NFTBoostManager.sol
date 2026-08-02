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
    enum NFTType {
        ERC721,
        ERC1155
    }

    struct CollectionInfo
    {
        bool enabled;
        NFTType nftType;
        uint16 boostPercent;
        uint256 tokenId;
        string name;
    }

    mapping(address => CollectionInfo)
        public collections;

    address[] public collectionList;

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

    constructor(
        address owner
    )
        Ownable(owner)
    {

    }

    function addERC721Collection(
        address collection,
        string calldata name,
        uint16 boost
    )
        external
        onlyOwner
    {
        require(collection != address(0));
        require(boost >= 100);

        collections[collection] =
            CollectionInfo({

                enabled:true,

                nftType:NFTType.ERC721,

                boostPercent:boost,

                tokenId:0,

                name:name

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
        uint16 boost
    )
        external
        onlyOwner
    {
        require(collection != address(0));
        require(boost >= 100);

        collections[collection] =
            CollectionInfo({

                enabled:true,

                nftType:NFTType.ERC1155,

                boostPercent:boost,

                tokenId:tokenId,

                name:name

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
        bool enabled
    )
        external
        onlyOwner
    {
        require(
            collections[collection]
            .boostPercent > 0
        );

        collections[collection]
            .boostPercent = boost;

        collections[collection]
            .enabled = enabled;

        emit CollectionUpdated(
            collection,
            boost,
            enabled
        );
    }

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

        if(!c.enabled)
            return false;

        if(c.nftType == NFTType.ERC721){

            return
                IERC721(collection)
                .balanceOf(user)
                >0;

        }

        return
            IERC1155(collection)
            .balanceOf(
                user,
                c.tokenId
            )>0;
    }

    function userBoost(
        address user
    )
        public
        view
        returns(uint16)
    {
        uint16 best = 100;

        uint256 len =
            collectionList.length;

        for(
            uint256 i=0;
            i<len;
            i++
        ){

            address col =
                collectionList[i];

            if(
                hasNFT(
                    user,
                    col
                )
            ){

                uint16 boost =
                    collections[col]
                    .boostPercent;

                if(boost > best){

                    best = boost;

                }

            }

        }

        return best;
    }

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
        address c =
            collectionList[index];

        return(
            c,
            collections[c]
        );
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

    function version()
        external
        pure
        returns(string memory)
    {
        return "NFTBoostManager V2";
    }
}