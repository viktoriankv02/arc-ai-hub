// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AIReputation is Ownable {

    struct Reputation {

        uint256 completedJobs;

        uint256 failedJobs;

        uint256 totalRating;

        uint256 ratingCount;

        uint256 reputation;

        bool verified;

        uint256 totalEarned;

        uint256 lastJobTimestamp;

        uint256 uptimeScore;

        uint256 inferenceCount;
    }

    mapping(uint256 => Reputation) public agents;

    event ReputationUpdated(
        uint256 indexed agentId,
        uint256 reputation
    );

    event RatingAdded(
        uint256 indexed agentId,
        uint8 rating
    );

    constructor(
        address owner
    )
        Ownable(owner)
    {}

    function addSuccessfulJob(
        uint256 agentId
    )
        external
        onlyOwner
    {

        Reputation storage r =
            agents[agentId];

        r.completedJobs++;

        r.reputation += 10;

        emit ReputationUpdated(
            agentId,
            r.reputation
        );

    }

    function addFailedJob(
        uint256 agentId
    )
        external
        onlyOwner
    {

        Reputation storage r =
            agents[agentId];

        r.failedJobs++;

        if (r.reputation >= 20)
            r.reputation -= 20;

        emit ReputationUpdated(
            agentId,
            r.reputation
        );

    }

    function addRating(
        uint256 agentId,
        uint8 rating
    )
        external
        onlyOwner
    {

        require(
            rating >= 1 &&
            rating <= 5,
            "Invalid"
        );

        Reputation storage r =
            agents[agentId];

        r.totalRating += rating;

        r.ratingCount++;

        r.reputation += rating;

        emit RatingAdded(
            agentId,
            rating
        );

    }

    function verifyAgent(
        uint256 agentId
    )
        external
        onlyOwner
    {

        agents[agentId].verified = true;

        agents[agentId].reputation += 100;

    }

    function addEarnings(

        uint256 agentId,

        uint256 amount

    )

        external

        onlyOwner

    {

        Reputation storage r = agents[agentId];

        r.totalEarned += amount;

        r.lastJobTimestamp = block.timestamp;

    }

    function increaseInference(

        uint256 agentId

    )

        external

        onlyOwner

    {

        agents[agentId].inferenceCount++;

    }

    function increaseUptime(

        uint256 agentId,

        uint256 points

    )

        external

        onlyOwner

    {

        agents[agentId].uptimeScore += points;

    }

    function averageRating(
        uint256 agentId
    )
        public
        view
        returns(uint256)
    {

        Reputation storage r =
            agents[agentId];

        if(r.ratingCount==0)
            return 0;

        return
            r.totalRating*100/
            r.ratingCount;

    }

    function reputationDetails(

        uint256 agentId

    )

        external

        view

        returns(

            Reputation memory

        )

    {

        return agents[agentId];

    }

}