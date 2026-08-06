// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AIOrchestrator is Ownable {

    address public token;
    address public treasury;
    address public staking;
    address public nftBoost;
    address public questManager;
    address public rewardDistributor;
    address public aiRegistry;
    address public aiRuntime;
    address public aiWallet;
    address public aiMarketplace;
    address public aiComputePool;

    event ModuleUpdated(
        string indexed module,
        address indexed moduleAddress
    );

    constructor(address owner)
        Ownable(owner)
    {}

    function setToken(address _token)
        external
        onlyOwner
    {
        token = _token;

        emit ModuleUpdated(
            "TOKEN",
            _token
        );
    }

    function setTreasury(address _treasury)
        external
        onlyOwner
    {
        treasury = _treasury;

        emit ModuleUpdated(
            "TREASURY",
            _treasury
        );
    }

    function setStaking(address _staking)
        external
        onlyOwner
    {
        staking = _staking;

        emit ModuleUpdated(
            "STAKING",
            _staking
        );
    }

    function setNFTBoost(address _nftBoost)
        external
        onlyOwner
    {
        nftBoost = _nftBoost;

        emit ModuleUpdated(
            "NFTBOOST",
            _nftBoost
        );
    }

    function setQuestManager(address _quest)
        external
        onlyOwner
    {
        questManager = _quest;

        emit ModuleUpdated(
            "QUEST",
            _quest
        );
    }

    function setRewardDistributor(address _reward)
        external
        onlyOwner
    {
        rewardDistributor = _reward;

        emit ModuleUpdated(
            "REWARD",
            _reward
        );
    }

    function setAIRegistry(address _registry)
        external
        onlyOwner
    {
        aiRegistry = _registry;

        emit ModuleUpdated(
            "REGISTRY",
            _registry
        );
    }

    function setAIRuntime(address _runtime)
        external
        onlyOwner
    {
        aiRuntime = _runtime;

        emit ModuleUpdated(
            "RUNTIME",
            _runtime
        );
    }

    function setAIWallet(address _wallet)
        external
        onlyOwner
    {
        aiWallet = _wallet;

        emit ModuleUpdated(
            "WALLET",
            _wallet
        );
    }

    function setMarketplace(address _market)
        external
        onlyOwner
    {
        aiMarketplace = _market;

        emit ModuleUpdated(
            "MARKET",
            _market
        );
    }

    function setComputePool(address _pool)
        external
        onlyOwner
    {
        aiComputePool = _pool;

        emit ModuleUpdated(
            "POOL",
            _pool
        );
    }

}