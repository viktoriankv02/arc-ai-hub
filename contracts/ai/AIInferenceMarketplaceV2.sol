// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AIInferenceMarketplaceV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidRequest();
    error InvalidAgent();
    error Unauthorized();
    error RequestNotPending();
    error RequestNotCompleted();
    error RequestAlreadySettled();

    enum RequestStatus {
        Pending,
        Completed,
        Cancelled,
        Settled
    }

    struct Agent {
        uint256 id;
        address provider;
        uint256 price;
        bool active;
    }

    struct InferenceRequest {
        uint256 id;
        uint256 agentId;
        address requester;
        address provider;
        uint256 price;
        uint256 createdAt;
        uint256 completedAt;
        bytes32 inputHash;
        bytes32 outputHash;
        RequestStatus status;
    }

    IERC20 public immutable paymentToken;

    uint256 public nextAgentId;
    uint256 public nextRequestId;

    uint256 public platformFeeBps = 500;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public feeRecipient;

    mapping(uint256 => Agent) private agents;

    mapping(uint256 => InferenceRequest) private requests;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed provider,
        uint256 price
    );

    event AgentPriceUpdated(
        uint256 indexed agentId,
        uint256 oldPrice,
        uint256 newPrice
    );

    event AgentStatusUpdated(
        uint256 indexed agentId,
        bool active
    );

    event InferenceRequested(
        uint256 indexed requestId,
        uint256 indexed agentId,
        address indexed requester,
        address provider,
        uint256 price,
        bytes32 inputHash
    );

    event InferenceCompleted(
        uint256 indexed requestId,
        bytes32 outputHash
    );

    event InferenceCancelled(
        uint256 indexed requestId
    );

    event InferenceSettled(
        uint256 indexed requestId,
        address indexed provider,
        uint256 providerAmount,
        uint256 platformFee
    );

    event PlatformFeeUpdated(
        uint256 oldFeeBps,
        uint256 newFeeBps
    );

    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    constructor(
        address token,
        address initialOwner,
        address initialFeeRecipient
    )
        Ownable(initialOwner)
    {
        if (
            token == address(0) ||
            initialOwner == address(0) ||
            initialFeeRecipient == address(0)
        ) {
            revert ZeroAddress();
        }

        paymentToken = IERC20(token);

        feeRecipient = initialFeeRecipient;
    }

    function registerAgent(
        uint256 price
    )
        external
        returns (uint256 agentId)
    {
        if (price == 0) {
            revert ZeroAmount();
        }

        agentId = nextAgentId;

        agents[agentId] = Agent({
            id: agentId,
            provider: msg.sender,
            price: price,
            active: true
        });

        unchecked {
            nextAgentId = agentId + 1;
        }

        emit AgentRegistered(
            agentId,
            msg.sender,
            price
        );
    }

    function updateAgentPrice(
        uint256 agentId,
        uint256 newPrice
    )
        external
    {
        Agent storage agent = agents[agentId];

        if (agent.provider == address(0)) {
            revert InvalidAgent();
        }

        if (agent.provider != msg.sender) {
            revert Unauthorized();
        }

        if (newPrice == 0) {
            revert ZeroAmount();
        }

        uint256 oldPrice = agent.price;

        agent.price = newPrice;

        emit AgentPriceUpdated(
            agentId,
            oldPrice,
            newPrice
        );
    }

    function setAgentActive(
        uint256 agentId,
        bool active
    )
        external
    {
        Agent storage agent = agents[agentId];

        if (agent.provider == address(0)) {
            revert InvalidAgent();
        }

        if (agent.provider != msg.sender) {
            revert Unauthorized();
        }

        agent.active = active;

        emit AgentStatusUpdated(
            agentId,
            active
        );
    }

    function requestInference(
        uint256 agentId,
        bytes32 inputHash
    )
        external
        nonReentrant
        returns (uint256 requestId)
    {
        Agent memory agent = agents[agentId];

        if (
            agent.provider == address(0) ||
            !agent.active
        ) {
            revert InvalidAgent();
        }

        requestId = nextRequestId;

        paymentToken.safeTransferFrom(
            msg.sender,
            address(this),
            agent.price
        );

        requests[requestId] = InferenceRequest({
            id: requestId,
            agentId: agentId,
            requester: msg.sender,
            provider: agent.provider,
            price: agent.price,
            createdAt: block.timestamp,
            completedAt: 0,
            inputHash: inputHash,
            outputHash: bytes32(0),
            status: RequestStatus.Pending
        });

        unchecked {
            nextRequestId = requestId + 1;
        }

        emit InferenceRequested(
            requestId,
            agentId,
            msg.sender,
            agent.provider,
            agent.price,
            inputHash
        );
    }

    function completeInference(
        uint256 requestId,
        bytes32 outputHash
    )
        external
    {
        InferenceRequest storage request =
            requests[requestId];

        if (request.requester == address(0)) {
            revert InvalidRequest();
        }

        if (request.provider != msg.sender) {
            revert Unauthorized();
        }

        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending();
        }

        request.outputHash = outputHash;

        request.completedAt = block.timestamp;

        request.status = RequestStatus.Completed;

        emit InferenceCompleted(
            requestId,
            outputHash
        );
    }

    function settleInference(
        uint256 requestId
    )
        external
        nonReentrant
    {
        InferenceRequest storage request =
            requests[requestId];

        if (request.requester == address(0)) {
            revert InvalidRequest();
        }

        if (request.status == RequestStatus.Settled) {
            revert RequestAlreadySettled();
        }

        if (request.status != RequestStatus.Completed) {
            revert RequestNotCompleted();
        }

        uint256 fee =
            (
                request.price *
                platformFeeBps
            )
            /
            BPS_DENOMINATOR;

        uint256 providerAmount =
            request.price - fee;

        request.status =
            RequestStatus.Settled;

        if (providerAmount > 0) {
            paymentToken.safeTransfer(
                request.provider,
                providerAmount
            );
        }

        if (fee > 0) {
            paymentToken.safeTransfer(
                feeRecipient,
                fee
            );
        }

        emit InferenceSettled(
            requestId,
            request.provider,
            providerAmount,
            fee
        );
    }

    function cancelInference(
        uint256 requestId
    )
        external
        nonReentrant
    {
        InferenceRequest storage request =
            requests[requestId];

        if (request.requester == address(0)) {
            revert InvalidRequest();
        }

        if (request.requester != msg.sender) {
            revert Unauthorized();
        }

        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending();
        }

        request.status =
            RequestStatus.Cancelled;

        paymentToken.safeTransfer(
            request.requester,
            request.price
        );

        emit InferenceCancelled(
            requestId
        );
    }

    function setPlatformFee(
        uint256 newFeeBps
    )
        external
        onlyOwner
    {
        require(
            newFeeBps <= 2000,
            "Fee too high"
        );

        uint256 oldFee =
            platformFeeBps;

        platformFeeBps =
            newFeeBps;

        emit PlatformFeeUpdated(
            oldFee,
            newFeeBps
        );
    }

    function setFeeRecipient(
        address newRecipient
    )
        external
        onlyOwner
    {
        if (newRecipient == address(0)) {
            revert ZeroAddress();
        }

        address oldRecipient =
            feeRecipient;

        feeRecipient =
            newRecipient;

        emit FeeRecipientUpdated(
            oldRecipient,
            newRecipient
        );
    }

    function getAgent(
        uint256 agentId
    )
        external
        view
        returns (Agent memory)
    {
        Agent memory agent =
            agents[agentId];

        if (agent.provider == address(0)) {
            revert InvalidAgent();
        }

        return agent;
    }

    function getRequest(
        uint256 requestId
    )
        external
        view
        returns (InferenceRequest memory)
    {
        InferenceRequest memory request =
            requests[requestId];

        if (request.requester == address(0)) {
            revert InvalidRequest();
        }

        return request;
    }
}