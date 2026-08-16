import { network } from "hardhat";

const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const AGENT_ID = 0n;

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [wallet] = await ethers.getSigners();
    const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);

    const agent = await runtime.getAgent(AGENT_ID);

    console.log("=================================");
    console.log("ARC AI HUB - START AI AGENT V2");
    console.log("=================================");
    console.log("Wallet:", wallet.address);
    console.log("Runtime:", RUNTIME);
    console.log("");

    console.log("CURRENT STATE");
    console.log("---------------------------------");
    console.log("Agent ID:", AGENT_ID.toString());
    console.log("Owner:", agent.owner);
    console.log("Status:", agent.status.toString());
    console.log("Exists:", agent.exists);

    if (!agent.exists) {
        throw new Error("Agent #0 does not exist in Runtime V2");
    }

    console.log("");
    console.log("1. STATIC CALL");
    console.log("---------------------------------");
    await runtime.startAgent.staticCall(AGENT_ID);
    console.log("STATIC CALL: SUCCESS");

    console.log("");
    console.log("2. GAS ESTIMATION");
    console.log("---------------------------------");
    const gas = await runtime.startAgent.estimateGas(AGENT_ID);
    console.log("Estimated gas:", gas.toString());

    console.log("");
    console.log("3. SEND TRANSACTION");
    console.log("---------------------------------");
    const tx = await runtime.startAgent(AGENT_ID);
    console.log("TX:", tx.hash);
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("Receipt status:", receipt.status);
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    const finalAgent = await runtime.getAgent(AGENT_ID);

    console.log("");
    console.log("4. FINAL STATE");
    console.log("---------------------------------");
    console.log("Agent ID:", finalAgent.id.toString());
    console.log("Status:", finalAgent.status.toString());
    console.log("Updated:", finalAgent.updatedAt.toString());

    if (finalAgent.status !== 1n) {
        throw new Error("Agent is not Running after transaction");
    }

    console.log("");
    console.log("=================================");
    console.log("AI AGENT #0 IS RUNNING");
    console.log("=================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
