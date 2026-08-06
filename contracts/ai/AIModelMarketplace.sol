// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./AIModelRegistry.sol";

interface ITreasury {

    function depositToken(
        address token,
        uint256 amount
    ) external;

}

contract AIModelMarketplace is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{

    struct Listing {

        uint256 id;

        uint256 modelId;

        address seller;

        uint256 price;

        bool active;

        uint256 sales;

    }

    AIModelRegistry public registry;

    IERC20 public paymentToken;

    ITreasury public treasury;

    uint256 public nextListingId = 1;

    uint256 public feePercent = 5;

    mapping(uint256 => Listing) public listings;

    mapping(uint256 => bool) public modelListed;

    mapping(uint256 => mapping(address => bool))
        public purchased;

    event ModelListed(

        uint256 indexed listingId,

        uint256 indexed modelId,

        address seller,

        uint256 price

    );

    event ModelPurchased(

        uint256 indexed listingId,

        address buyer,

        uint256 price

    );

    event ListingCancelled(

        uint256 indexed listingId

    );

    constructor(

        address owner,

        address registryAddress,

        address token,

        address treasuryAddress

    )

        Ownable(owner)

    {

        registry =
            AIModelRegistry(
                registryAddress
            );

        paymentToken =
            IERC20(token);

        treasury =
            ITreasury(
                treasuryAddress
            );

    }
        function listModel(

        uint256 modelId,

        uint256 price

    )

        external

        whenNotPaused

    {

        require(

            price > 0,

            "Invalid price"

        );

        require(

            !modelListed[modelId],

            "Already listed"

        );

        (

            uint256 id,
            string memory name,
            string memory description,
            string memory category,
            string memory version,
            string memory metadataURI,
            address developer,
            uint256 createdAt,
            uint256 updatedAt,
            AIModelRegistry.ModelStatus status,
            bool verified

        ) = registry.models(modelId);

        require(

            developer == msg.sender,

            "Not developer"

        );

        listings[nextListingId] = Listing({

            id:nextListingId,

            modelId:modelId,

            seller:msg.sender,

            price:price,

            active:true,

            sales:0

        });

        modelListed[modelId] = true;

        emit ModelListed(

            nextListingId,

            modelId,

            msg.sender,

            price

        );

        nextListingId++;

    }
        function buy(

        uint256 listingId

    )

        external

        nonReentrant

        whenNotPaused

    {

        Listing storage listing =
            listings[listingId];

        require(

            listing.active,

            "Inactive"

        );

        require(

            !purchased

            [listing.modelId]

            [msg.sender],

            "Already purchased"

        );

        uint256 fee =
            listing.price *
            feePercent /
            100;

        uint256 sellerAmount =
            listing.price -
            fee;

        paymentToken.transferFrom(

            msg.sender,

            listing.seller,

            sellerAmount

        );

        paymentToken.transferFrom(

            msg.sender,

            address(treasury),

            fee

        );

        purchased

            [listing.modelId]

            [msg.sender]

            = true;

        listing.sales++;

        emit ModelPurchased(

            listingId,

            msg.sender,

            listing.price

        );

    }
        function cancelListing(

        uint256 listingId

    )

        external

    {

        Listing storage listing =
            listings[listingId];

        require(

            listing.seller == msg.sender,

            "Not seller"

        );

        listing.active = false;

        modelListed
            [listing.modelId]
            = false;

        emit ListingCancelled(
            listingId
        );

    }

    function setFee(

        uint256 fee

    )

        external

        onlyOwner

    {

        require(

            fee <= 20,

            "Too high"

        );

        feePercent = fee;

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

}