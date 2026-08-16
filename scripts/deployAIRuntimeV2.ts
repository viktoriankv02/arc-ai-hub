import { network } from "hardhat";

async function main() {
    const { ethers } = await network.connect("arcTestnet");
    const [owner] = await ethers.getSigners();

    console.log("=================================");
    console.log("ARC AI HUB - AI RUNTIME V2");
    console.log("=================================");
    console.log("Owner:", owner.address);
    console.log("");

    const Runtime = await ethers.getContractFactory("AIAgentRuntimeV2");
    const runtime = await Runtime.deploy(owner.address);
    await runtime.waitForDeployment();

    const address = await runtime.getAddress();

    console.log("AIAgentRuntime V2:", address);
    console.log("");
    console.log("=================================");
    console.log("RUNTIME V2 DEPLOYED");
    console.log("=================================");
    console.log(`AI_AGENT_RUNTIME_V2_ADDRESS=${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
