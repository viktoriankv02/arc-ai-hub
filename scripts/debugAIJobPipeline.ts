import { network } from "hardhat";

const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const JOB_MANAGER = "0x646903405E0672055835B849b556b9771c943032";
const SCHEDULER = "0xC4274F6dDEa03c04F724B2e2dd9ea4AdFa9C4025";
const COMPUTE_POOL = "0xe094faD07Ce56aF3E47c6a62021f34F4aF458DE0";
const ORACLE = "0xE0B8a94B8e35289f15B3ae54328cd690903a1C2A";
const AGENT_ID = 0n;
const NODE_ID = 0n;

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [wallet] = await ethers.getSigners();

    console.log("=================================");
    console.log("ARC AI HUB - JOB PIPELINE DEBUG");
    console.log("=================================");
    console.log("Wallet:", wallet.address);
    console.log("");

    const jobManager = await ethers.getContractAt("AIJobManager", JOB_MANAGER);
    const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
    const scheduler = await ethers.getContractAt("AIScheduler", SCHEDULER);
    const pool = await ethers.getContractAt("AIComputePool", COMPUTE_POOL);
    const oracle = await ethers.getContractAt("AIReputationOracle", ORACLE);

    console.log("1. JOB MANAGER LINKS");
    console.log("---------------------------------");
    console.log("Scheduler:", await jobManager.scheduler());
    console.log("Runtime:", await jobManager.runtime());
    console.log("ComputePool:", await jobManager.computePool());
    console.log("Oracle:", await jobManager.reputationOracle());

    console.log("");
    console.log("2. RUNTIME");
    console.log("---------------------------------");
    console.log("Controller:", await runtime.isController(JOB_MANAGER));
    const agent = await runtime.getAgent(AGENT_ID);
    console.log("Agent:", AGENT_ID.toString());
    console.log("Agent owner:", agent.owner);
    console.log("Agent status:", agent.status.toString());
    console.log("Agent exists:", agent.exists);

    console.log("");
    console.log("3. COMPUTE NODE");
    console.log("---------------------------------");
    const node = await pool.getNode(NODE_ID);
    console.log("Node ID:", node.id.toString());
    console.log("Node owner:", node.owner);
    console.log("GPU:", node.gpuModel);
    console.log("GPU memory:", node.gpuMemory.toString(), "GB");
    console.log("CPU cores:", node.cpuCores.toString());
    console.log("RAM:", node.ram.toString(), "GB");
    console.log("Region:", node.region);
    console.log("Status:", node.status.toString());
    console.log("Stake:", ethers.formatEther(node.stake));
    console.log("Reputation:", node.reputation.toString());
    console.log("Completed jobs:", node.completedJobs.toString());
    console.log("Active jobs:", node.activeJobs.toString());
    console.log("Score:", node.score.toString());

    console.log("");
    console.log("4. REPUTATION ORACLE");
    console.log("---------------------------------");
    console.log("Reputation contract:", await oracle.reputation());

    console.log("");
    console.log("5. SCHEDULER");
    console.log("---------------------------------");
    console.log("Next assignment ID:", (await scheduler.nextAssignmentId()).toString());

    console.log("");
    console.log("6. JOB MANAGER");
    console.log("---------------------------------");
    const nextJobId = await jobManager.nextJobId();
    console.log("Next Job ID:", nextJobId.toString());

    if (nextJobId > 0n) {
        const lastJobId = nextJobId - 1n;
        const job = await jobManager.jobs(lastJobId);
        console.log("Last job ID:", job.id.toString());
        console.log("User:", job.user);
        console.log("Agent ID:", job.agentId.toString());
        console.log("Node ID:", job.computeNodeId.toString());
        console.log("Request ID:", job.requestId.toString());
        console.log("Reward:", ethers.formatEther(job.reward), "AIH");
        console.log("Status:", job.status.toString());
    }

    console.log("");
    console.log("=================================");
    console.log("PIPELINE DEBUG COMPLETE");
    console.log("=================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
