import { network } from "hardhat";

const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const AGENT_ID = 0n;

async function printState(runtime: any, label: string) {
    const agent = await runtime.getAgent(AGENT_ID);
    console.log("");
    console.log(label);
    console.log("---------------------------------");
    console.log("Agent ID:", agent.id.toString());
    console.log("Owner:", agent.owner);
    console.log("Name:", agent.name);
    console.log("Endpoint:", agent.endpoint);
    console.log("Metadata:", agent.metadataURI);
    console.log("Version:", agent.version);
    console.log("Status:", agent.status.toString());
    console.log("Heartbeat:", agent.heartbeat.toString());
    console.log("Updated:", agent.updatedAt.toString());
    console.log("Exists:", agent.exists);
    return agent;
}

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [wallet] = await ethers.getSigners();
    const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);

    console.log("=================================");
    console.log("ARC AI HUB - AI AGENT LIFECYCLE V2");
    console.log("=================================");
    console.log("Wallet:", wallet.address);
    console.log("Runtime:", RUNTIME);
    console.log("Agent ID:", AGENT_ID.toString());

    let agent = await printState(runtime, "INITIAL STATE");

    if (!agent.exists) {
        console.log("");
        console.log("Agent #0 does not exist. Registering...");
        const tx = await runtime.registerAgent(
            "Arc AI Compute Agent",
            "https://api.arc-ai-hub.local/v2/inference",
            "ipfs://arc-ai-hub/agent-0-v2",
            "2.0.0"
        );
        console.log("TX:", tx.hash);
        await tx.wait();
        agent = await printState(runtime, "STATE AFTER REGISTRATION");
    }

    if (agent.status !== 1n) {
        console.log("");
        console.log("1. START / RESUME AGENT");
        console.log("---------------------------------");
        const tx = await runtime.startAgent(AGENT_ID);
        console.log("TX:", tx.hash);
        await tx.wait();
        await printState(runtime, "STATE AFTER START");
    } else {
        console.log("");
        console.log("1. START / RESUME AGENT");
        console.log("---------------------------------");
        console.log("Agent already Running. Skipping transaction.");
    }

    console.log("");
    console.log("2. HEARTBEAT");
    console.log("---------------------------------");
    {
        const tx = await runtime.heartbeat(AGENT_ID);
        console.log("TX:", tx.hash);
        const receipt = await tx.wait();
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
    }
    await printState(runtime, "STATE AFTER HEARTBEAT");

    console.log("");
    console.log("3. UPDATE METADATA");
    console.log("---------------------------------");
    {
        const tx = await runtime.updateMetadata(
            AGENT_ID,
            "https://api.arc-ai-hub.local/v2/inference",
            "ipfs://arc-ai-hub/agent-0-v2",
            "2.0.0"
        );
        console.log("TX:", tx.hash);
        const receipt = await tx.wait();
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
    }
    await printState(runtime, "STATE AFTER METADATA UPDATE");

    console.log("");
    console.log("4. PAUSE AGENT");
    console.log("---------------------------------");
    {
        const tx = await runtime.pauseAgent(AGENT_ID);
        console.log("TX:", tx.hash);
        const receipt = await tx.wait();
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
    }
    await printState(runtime, "STATE AFTER PAUSE");

    console.log("");
    console.log("5. RESUME AGENT");
    console.log("---------------------------------");
    {
        const tx = await runtime.startAgent(AGENT_ID);
        console.log("TX:", tx.hash);
        const receipt = await tx.wait();
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
    }
    agent = await printState(runtime, "STATE AFTER RESUME");

    if (agent.status !== 1n) {
        throw new Error("Agent did not return to Running state");
    }

    console.log("");
    console.log("=================================");
    console.log("LIFECYCLE TEST PASSED");
    console.log("AGENT #0 LEFT RUNNING");
    console.log("=================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
