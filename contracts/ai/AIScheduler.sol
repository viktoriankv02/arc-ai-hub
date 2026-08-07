// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AIScheduler is Ownable {

    struct Assignment {

        uint256 jobId;

        uint256 agentId;

        uint256 assignedAt;

        bool active;

    }

    uint256 public nextAssignmentId;

    mapping(uint256 => Assignment) public assignments;

    event Assigned(

        uint256 indexed assignmentId,

        uint256 indexed jobId,

        uint256 indexed agentId

    );

    constructor(

        address owner

    )

        Ownable(owner)

    {}

    function assign(

        uint256 jobId,

        uint256 agentId

    )

        external

        onlyOwner

    {

        _schedule(jobId, agentId);

    }

    function scheduleJob(

        uint256 jobId,

        uint256 agentId

    )

        external

    {

        _schedule(jobId, agentId);

    }

    function _schedule(

        uint256 jobId,

        uint256 agentId

    )

        internal

    {

        assignments[nextAssignmentId] = Assignment({

            jobId: jobId,

            agentId: agentId,

            assignedAt: block.timestamp,

            active: true

        });

        emit Assigned(

            nextAssignmentId,

            jobId,

            agentId

        );

        nextAssignmentId++;

    }

}