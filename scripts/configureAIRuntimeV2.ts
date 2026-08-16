import { network } from "hardhat";

const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const JOB_MANAGER = "0x646903405E0672055835B849b556b9771c943032";
const SCHEDULER = "0xC4274F6dDEa03c04F724B2e2dd9ea4AdFa9C4025";
const COMPUTE_POOL = "0xe094faD07Ce56aF3E47c6a62021f34F4aF458DE0";
const REPUTATION_ORACLE = "0xE0B8a94B8e35289f15B3ae54328cd690903a1C2A";

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [owner] = await ethers.getSigners();

    console.log("=================================");
    console.log("ARC AI HUB - CONFIGURE RUNTIME V2");
    console.log("=================================");
    console.log("Owner:", owner.address);
    console.log("Runtime:", RUNTIME);
    console.log("");

    const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
    const jobManager = await ethers.getContractAt("AIJobManager", JOB_MANAGER);

    console.log("1. SET RUNTIME CONTROLLER");
    console.log("---------------------------------");
    const before = await runtime.isController(JOB_MANAGER);
    console.log("Before:", before);

    if (!before) {
        const tx = await runtime.setController(JOB_MANAGER, true);
        console.log("TX:", tx.hash);
        await tx.wait();
        console.log("Controller enabled.");
    } else {
        console.log("Already enabled.");
    }

    console.log("");
    console.log("2. CONFIGURE AI JOB MANAGER");
    console.log("---------------------------------");
    console.log("Scheduler:", SCHEDULER);
    console.log("Runtime:", RUNTIME);
    console.log("Compute Pool:", COMPUTE_POOL);
    console.log("Reputation Oracle:", REPUTATION_ORACLE);

    const currentScheduler = await jobManager.scheduler();
    const currentRuntime = await jobManager.runtime();
    const currentPool = await jobManager.computePool();
    const currentOracle = await jobManager.reputationOracle();

    console.log("");
    console.log("CURRENT LINKS");
    console.log("Scheduler:", currentScheduler);
    console.log("Runtime:", currentRuntime);
    console.log("Compute Pool:", currentPool);
    console.log("Reputation Oracle:", currentOracle);

    const needsUpdate =
        currentScheduler.toLowerCase() !== SCHEDULER.toLowerCase() ||
        currentRuntime.toLowerCase() !== RUNTIME.toLowerCase() ||
        currentPool.toLowerCase() !== COMPUTE_POOL.toLowerCase() ||
        currentOracle.toLowerCase() !== REPUTATION_ORACLE.toLowerCase();

    if (needsUpdate) {
        console.log("");
        console.log("Updating AIJobManager...");
        const tx = await jobManager.setContracts(
            SCHEDULER,
            RUNTIME,
            COMPUTE_POOL,
            REPUTATION_ORACLE
        );
        console.log("TX:", tx.hash);
        await tx.wait();
        console.log("AIJobManager configured.");
    } else {
        console.log("AIJobManager already configured.");
    }

    console.log("");
    console.log("3. VERIFY");
    console.log("---------------------------------");
    console.log("Runtime controller:", await runtime.isController(JOB_MANAGER));
    console.log("JobManager scheduler:", await jobManager.scheduler());
    console.log("JobManager runtime:", await jobManager.runtime());
    console.log("JobManager computePool:", await jobManager.computePool());
    console.log("JobManager oracle:", await jobManager.reputationOracle());

    console.log("");
    console.log("=================================");
    console.log("RUNTIME V2 CONFIGURATION COMPLETE");
    console.log("=================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
