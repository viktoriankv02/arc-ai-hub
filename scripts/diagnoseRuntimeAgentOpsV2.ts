import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEPLOYMENT_FILE = join(process.cwd(), "deployments", "secure-pipeline-v2-latest.json");

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();
  const d = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", d.runtime);

  const agents = await runtime.getOwnerAgents(owner.address);
  if (agents.length === 0) throw new Error("No owner agent found");
  const agentId = agents[0];
  const runtimeAddress = await runtime.getAddress();

  console.log("=================================");
  console.log("ARC AI HUB - RUNTIME AGENT OPS DIAGNOSTIC");
  console.log("=================================");
  console.log("Runtime:", runtimeAddress);
  console.log("Owner:", owner.address);
  console.log("Agent:", agentId.toString());
  console.log("Owner:", await runtime.owner());
  console.log("Controller(owner):", await runtime.isController(owner.address));
  console.log("Code bytes:", ((await ethers.provider.getCode(runtimeAddress)).length - 2) / 2);

  const before = await runtime.getAgent(agentId);
  console.log("Before:", {
    status: before.status.toString(),
    owner: before.owner,
    exists: before.exists,
  });

  for (const fn of ["pauseAgent", "startAgent"] as const) {
    const data = runtime.interface.encodeFunctionData(fn, [agentId]);
    console.log(`\n${fn}`);
    console.log("selector:", data.slice(0, 10));
    console.log("calldata bytes:", (data.length - 2) / 2);

    try {
      const result = await ethers.provider.call({
        to: runtimeAddress,
        from: owner.address,
        data,
      });
      console.log("eth_call: SUCCESS", result);
    } catch (error: any) {
      console.log("eth_call: REVERT");
      console.log("code:", error?.code);
      console.log("data:", error?.data ?? error?.info?.error?.data ?? "none");
      console.log("message:", error?.shortMessage ?? error?.message ?? "unknown");
    }

    try {
      const populated = await runtime[fn].populateTransaction(agentId);
      console.log("populated.to:", populated.to);
      console.log("populated.data:", populated.data);
      const tx = await owner.sendTransaction({
        to: populated.to,
        data: populated.data,
        gasLimit: 100_000n,
      });
      console.log("tx:", tx.hash);
      await tx.wait();
      console.log("tx: SUCCESS");
    } catch (error: any) {
      console.log("tx: REVERT");
      console.log("code:", error?.code);
      console.log("data:", error?.data ?? error?.info?.error?.data ?? "none");
      console.log("message:", error?.shortMessage ?? error?.message ?? "unknown");
    }

    const after = await runtime.getAgent(agentId);
    console.log("state after:", after.status.toString());
  }

  console.log("\nDIAGNOSTIC COMPLETE");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
