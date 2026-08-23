import { network } from "hardhat";

const ADDRESSES = {
    gateway: "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1",
    manager: "0x9Cf3aCd8666E59bC730345071fD0cE1e2251C3EB",
    runtime: "0x203A7730AEb665FCB1F29232ccf6e041a2b73288",
    pool: "0x53C6C04b5A0FC49B4edB99A0F979D325e4Eb775b",
    oracle: "0x0c0dd76e07C4efB35e70bca9C7EE5eA6cBB1EBA9",
    reputation: "0xCd3902B5E566E8922392464013E0173722f05627",
    scheduler: "0xC4274F6dDEa03c04F724B2e2dd9ea4AdFa9C4025",
    rewardToken: "0xCf9b53A409e6F899016F3b9E0E635Dd2A347B3a5",
};

const AGENT_ID = 0n;
const NODE_ID = 0n;

function same(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

function check(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`FAILED: ${message}`);
    }

    console.log(`OK: ${message}`);
}

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [owner] = await ethers.getSigners();

    console.log("=================================");
    console.log("ARC AI HUB - V2 PRODUCTION VERIFICATION");
    console.log("=================================");
    console.log("Owner:", owner.address);
    console.log("");

    console.log("NETWORK");
    console.log("---------------------------------");

    const networkInfo = await ethers.provider.getNetwork();

    console.log("Chain ID:", networkInfo.chainId.toString());

    check(
        networkInfo.chainId === 5042002n,
        "Arc Testnet chain ID = 5042002"
    );

    console.log("");

    const gateway = await ethers.getContractAt(
        "AIAPIGateway",
        ADDRESSES.gateway
    );

    const manager = await ethers.getContractAt(
        "AIJobManager",
        ADDRESSES.manager
    );

    const runtime = await ethers.getContractAt(
        "AIAgentRuntimeV2",
        ADDRESSES.runtime
    );

    const pool = await ethers.getContractAt(
        "AIComputePoolV2",
        ADDRESSES.pool
    );

    const oracle = await ethers.getContractAt(
        "AIReputationOracleV2",
        ADDRESSES.oracle
    );

    console.log("1. CONTRACT CODE");
    console.log("---------------------------------");

    const contracts = [
        ["Gateway", ADDRESSES.gateway],
        ["Manager", ADDRESSES.manager],
        ["Runtime V2", ADDRESSES.runtime],
        ["Compute Pool V2", ADDRESSES.pool],
        ["Reputation Oracle V2", ADDRESSES.oracle],
        ["Reputation", ADDRESSES.reputation],
        ["Scheduler", ADDRESSES.scheduler],
        ["Reward Token", ADDRESSES.rewardToken],
    ] as const;

    for (const [name, address] of contracts) {
        const code = await ethers.provider.getCode(address);
        const bytes = (code.length - 2) / 2;

        console.log(`${name}: ${address}`);
        console.log(`  bytecode: ${bytes} bytes`);

        check(
            code !== "0x" && code.length > 2,
            `${name} has deployed bytecode`
        );
    }

    console.log("");

    console.log("2. OWNERSHIP");
    console.log("---------------------------------");

    check(
        same(await runtime.owner(), owner.address),
        "Runtime owner matches signer"
    );

    check(
        same(await pool.owner(), owner.address),
        "Compute Pool owner matches signer"
    );

    check(
        same(await oracle.owner(), owner.address),
        "Oracle owner matches signer"
    );

    console.log("");

    console.log("3. CONTROLLERS");
    console.log("---------------------------------");

    // Runtime V2 exposes an explicit isController() view.
    check(
        await runtime.isController(ADDRESSES.manager),
        "Runtime controller = Manager"
    );

    // Pool V2 and Oracle V2 expose their controller registry as a public
    // mapping (`controllers(address)`), not an isController() function.
    check(
        await pool.controllers(ADDRESSES.manager),
        "Pool controller = Manager"
    );

    check(
        await oracle.controllers(ADDRESSES.manager),
        "Oracle controller = Manager"
    );

    console.log("");

    console.log("4. MANAGER WIRING");
    console.log("---------------------------------");

    const managerGateway = await manager.gateway();
    const managerRuntime = await manager.runtime();
    const managerPool = await manager.computePool();
    const managerOracle = await manager.reputationOracle();
    const managerScheduler = await manager.scheduler();

    console.log("Gateway:", managerGateway);
    console.log("Runtime:", managerRuntime);
    console.log("Pool:", managerPool);
    console.log("Oracle:", managerOracle);
    console.log("Scheduler:", managerScheduler);

    check(
        same(managerGateway, ADDRESSES.gateway),
        "Manager -> Gateway"
    );

    check(
        same(managerRuntime, ADDRESSES.runtime),
        "Manager -> Runtime V2"
    );

    check(
        same(managerPool, ADDRESSES.pool),
        "Manager -> Compute Pool V2"
    );

    check(
        same(managerOracle, ADDRESSES.oracle),
        "Manager -> Reputation Oracle V2"
    );

    check(
        same(managerScheduler, ADDRESSES.scheduler),
        "Manager -> Scheduler"
    );

    console.log("");

    console.log("5. GATEWAY WIRING");
    console.log("---------------------------------");

    const gatewayManager = await gateway.jobManager();

    console.log("Gateway Manager:", gatewayManager);

    check(
        same(gatewayManager, ADDRESSES.manager),
        "Gateway -> Manager"
    );

    console.log("");

    console.log("6. AGENT STATE");
    console.log("---------------------------------");

    const agent = await runtime.getAgent(AGENT_ID);

    console.log("Agent ID:", agent.id.toString());
    console.log("Owner:", agent.owner);
    console.log("Status:", agent.status.toString());
    console.log("Exists:", agent.exists);
    console.log("Heartbeat:", agent.heartbeat.toString());
    console.log("Version:", agent.version);

    check(
        agent.exists,
        "Agent #0 exists"
    );

    check(
        same(agent.owner, owner.address),
        "Agent owner matches deployer"
    );

    check(
        agent.status === 1n,
        "Agent #0 is Running"
    );

    console.log("");

    console.log("7. COMPUTE NODE");
    console.log("---------------------------------");

    const node = await pool.getNode(NODE_ID);

    console.log("Node ID:", node.id.toString());
    console.log("Owner:", node.owner);
    console.log("Status:", node.status.toString());
    console.log("Stake:", ethers.formatEther(node.stake));
    console.log("Completed jobs:", node.completedJobs.toString());
    console.log("Failed jobs:", node.failedJobs.toString());
    console.log("Active jobs:", node.activeJobs.toString());

    check(
        same(node.owner, owner.address),
        "Node owner matches deployer"
    );

    check(
        node.stake > 0n,
        "Compute node has positive stake"
    );

    check(
        node.status === 1n,
        "Compute node is available/online"
    );

    console.log("");

    console.log("8. PIPELINE STATE");
    console.log("---------------------------------");

    const nextRequestId = await gateway.nextRequestId();
    const nextJobId = await manager.nextJobId();

    console.log("Next request ID:", nextRequestId.toString());
    console.log("Next job ID:", nextJobId.toString());

    check(
        nextRequestId >= 3n,
        "Gateway contains successful regression requests"
    );

    check(
        nextJobId >= 3n,
        "Manager contains successful regression jobs"
    );

    console.log("");

    console.log("9. REPUTATION");
    console.log("---------------------------------");

    const reputationAddress = await oracle.reputation();

    console.log("Oracle reputation:", reputationAddress);

    check(
        same(reputationAddress, ADDRESSES.reputation),
        "Oracle -> Reputation"
    );

    console.log("");

    console.log("10. REGRESSION BASELINE");
    console.log("---------------------------------");

    console.log("Expected:");
    console.log("  successful jobs >= 2");
    console.log("  failed jobs >= 1");
    console.log("  nextRequestId >= 3");
    console.log("  nextJobId >= 3");

    if (nextJobId > 0n) {
        const lastJobId = nextJobId - 1n;
        const lastJob = await manager.jobs(lastJobId);

        console.log("");
        console.log("Latest job:");
        console.log("  ID:", lastJob.id.toString());
        console.log("  User:", lastJob.user);
        console.log("  Agent:", lastJob.agentId.toString());
        console.log("  Node:", lastJob.computeNodeId.toString());
        console.log("  Request:", lastJob.requestId.toString());
        console.log("  Reward:", ethers.formatEther(lastJob.reward));
        console.log("  Status:", lastJob.status.toString());
    }

    console.log("");
    console.log("=================================");
    console.log("V2 PRODUCTION VERIFICATION SUCCESS");
    console.log("=================================");
    console.log("");
    console.log("Secure Pipeline V2:");
    console.log("Gateway -> Manager -> Runtime -> Pool -> Oracle");
    console.log("STATUS: READY");
}

main().catch((error) => {
    console.error("");
    console.error("=================================");
    console.error("V2 PRODUCTION VERIFICATION FAILED");
    console.error("=================================");
    console.error(error);
    process.exitCode = 1;
});