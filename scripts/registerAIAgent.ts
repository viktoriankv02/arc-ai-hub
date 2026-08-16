import { network } from "hardhat";

const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [owner] = await ethers.getSigners();
    const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);

    console.log("=================================");
    console.log("ARC AI HUB - REGISTER AI AGENT V2");
    console.log("=================================");
    console.log("Owner:", owner.address);
    console.log("");

    const before = await runtime.nextAgentId();
    console.log("Next Agent ID before:", before.toString());
    console.log("");
    console.log("Registering AI Agent #", before.toString());

    const tx = await runtime.registerAgent(
        "Arc AI Compute Agent",
        "https://api.arc-ai-hub.local/v2/inference",
        "ipfs://arc-ai-hub/agent-0-v2",
        "2.0.0"
    );

    console.log("Register TX:", tx.hash);
    await tx.wait();
    console.log("Registration confirmed.");

    const agent = await runtime.getAgent(before);

    console.log("");
    console.log("=================================");
    console.log("AI AGENT REGISTERED");
    console.log("=================================");
    console.log("Agent ID:", agent.id.toString());
    console.log("Owner:", agent.owner);
    console.log("Name:", agent.name);
    console.log("Endpoint:", agent.endpoint);
    console.log("Metadata:", agent.metadataURI);
    console.log("Version:", agent.version);
    console.log("Status:", agent.status.toString());
    console.log("Exists:", agent.exists);

    if (agent.owner.toLowerCase() !== owner.address.toLowerCase()) {
        throw new Error("Agent owner mismatch");
    }

    console.log("");
    console.log("Starting agent...");
    const startTx = await runtime.startAgent(before);
    console.log("Start TX:", startTx.hash);
    await startTx.wait();

    const runningAgent = await runtime.getAgent(before);
    console.log("Final status:", runningAgent.status.toString());

    if (runningAgent.status !== 1n) {
        throw new Error("Agent did not enter Running state");
    }

    console.log("");
    console.log("=================================");
    console.log(`AI AGENT #${before.toString()} RUNNING`);
    console.log("=================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
