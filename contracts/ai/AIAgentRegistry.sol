// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract AIAgentRegistry is Ownable2Step {

    enum AgentStatus {
        Inactive,
        Active,
        Deprecated
    }

    struct Agent {

        uint256 id;

        string name;

        string description;

        string version;

        string endpoint;

        address developer;

        uint256 createdAt;

        uint256 updatedAt;

        AgentStatus status;

        bool verified;
    }

    uint256 public nextAgentId = 1;

    mapping(uint256 => Agent) public agents;

    mapping(address => uint256[]) public developerAgents;

    event AgentRegistered(

        uint256 indexed id,

        address indexed developer,

        string name

    );

    event AgentUpdated(

        uint256 indexed id

    );

    event AgentVerified(

        uint256 indexed id

    );

    event AgentStatusChanged(

        uint256 indexed id,

        AgentStatus status

    );

    constructor(address owner)

        Ownable(owner)

    {}

    function registerAgent(

        string calldata name,

        string calldata description,

        string calldata version,

        string calldata endpoint

    )

        external

        returns(uint256)

    {

        uint256 id = nextAgentId++;

        agents[id] = Agent({

            id:id,

            name:name,

            description:description,

            version:version,

            endpoint:endpoint,

            developer:msg.sender,

            createdAt:block.timestamp,

            updatedAt:block.timestamp,

            status:AgentStatus.Active,

            verified:false

        });

        developerAgents[msg.sender].push(id);

        emit AgentRegistered(

            id,

            msg.sender,

            name

        );

        return id;
    }

    function updateAgent(

        uint256 id,

        string calldata description,

        string calldata version,

        string calldata endpoint

    )

        external

    {

        Agent storage agent = agents[id];

        require(

            agent.developer == msg.sender,

            "Not developer"

        );

        agent.description = description;

        agent.version = version;

        agent.endpoint = endpoint;

        agent.updatedAt = block.timestamp;

        emit AgentUpdated(id);
    }

    function verifyAgent(

        uint256 id

    )

        external

        onlyOwner

    {

        agents[id].verified = true;

        emit AgentVerified(id);

    }

    function changeStatus(

        uint256 id,

        AgentStatus status

    )

        external

        onlyOwner

    {

        agents[id].status = status;

        emit AgentStatusChanged(

            id,

            status

        );

    }

    function getDeveloperAgents(

        address developer

    )

        external

        view

        returns(uint256[] memory)

    {

        return developerAgents[developer];

    }

}