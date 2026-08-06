// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AIReputation.sol";

contract AIReputationOracle is Ownable {

    AIReputation public reputation;

    event ReputationProcessed(

        uint256 indexed agentId,

        bool success

    );

    constructor(

        address reputationContract,

        address owner

    )

        Ownable(owner)

    {

        reputation = AIReputation(reputationContract);

    }

    function processSuccessfulJob(

        uint256 agentId,

        uint256 reward

    )

        external

        onlyOwner

    {

        reputation.addSuccessfulJob(agentId);

        reputation.addEarnings(agentId, reward);

        reputation.increaseInference(agentId);

        emit ReputationProcessed(

            agentId,

            true

        );

    }

    function processFailedJob(

        uint256 agentId

    )

        external

        onlyOwner

    {

        reputation.addFailedJob(agentId);

        emit ReputationProcessed(

            agentId,

            false

        );

    }

    function processRating(

        uint256 agentId,

        uint8 rating

    )

        external

        onlyOwner

    {

        reputation.addRating(

            agentId,

            rating

        );

    }

    function processHeartbeat(

        uint256 agentId

    )

        external

        onlyOwner

    {

        reputation.increaseUptime(

            agentId,

            1

        );

    }

}