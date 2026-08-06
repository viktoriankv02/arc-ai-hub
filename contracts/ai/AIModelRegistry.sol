// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract AIModelRegistry is Ownable2Step, Pausable {

    enum ModelStatus {
        Draft,
        Active,
        Deprecated,
        Blocked
    }

    struct AIModel {

        uint256 id;

        string name;

        string description;

        string category;

        string version;

        string metadataURI;

        address developer;

        uint256 createdAt;

        uint256 updatedAt;

        ModelStatus status;

        bool verified;
    }

    uint256 public nextModelId = 1;

    mapping(uint256 => AIModel) public models;

    mapping(address => uint256[]) public developerModels;

    mapping(string => bool) public categoryExists;

    event ModelRegistered(

        uint256 indexed id,

        address indexed developer,

        string name,

        string category

    );

    event ModelUpdated(

        uint256 indexed id

    );

    event ModelVerified(

        uint256 indexed id

    );

    event StatusChanged(

        uint256 indexed id,

        ModelStatus status

    );

    constructor(address owner)
        Ownable(owner)
    {}

    function registerModel(

        string calldata name,

        string calldata description,

        string calldata category,

        string calldata version,

        string calldata metadataURI

    )

        external

        whenNotPaused

        returns(uint256)

    {

        uint256 id = nextModelId++;

        models[id] = AIModel({

            id:id,

            name:name,

            description:description,

            category:category,

            version:version,

            metadataURI:metadataURI,

            developer:msg.sender,

            createdAt:block.timestamp,

            updatedAt:block.timestamp,

            status:ModelStatus.Active,

            verified:false

        });

        developerModels[msg.sender].push(id);

        categoryExists[category] = true;

        emit ModelRegistered(

            id,

            msg.sender,

            name,

            category

        );

        return id;

    }

    function updateModel(

        uint256 id,

        string calldata description,

        string calldata version,

        string calldata metadataURI

    )

        external

        whenNotPaused

    {

        AIModel storage model = models[id];

        require(

            model.developer == msg.sender,

            "Not developer"

        );

        model.description = description;

        model.version = version;

        model.metadataURI = metadataURI;

        model.updatedAt = block.timestamp;

        emit ModelUpdated(id);

    }

    function verifyModel(

        uint256 id

    )

        external

        onlyOwner

    {

        models[id].verified = true;

        emit ModelVerified(id);

    }

    function changeStatus(

        uint256 id,

        ModelStatus status

    )

        external

        onlyOwner

    {

        models[id].status = status;

        emit StatusChanged(

            id,

            status

        );

    }

    function getDeveloperModels(

        address developer

    )

        external

        view

        returns(uint256[] memory)

    {

        return developerModels[developer];

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