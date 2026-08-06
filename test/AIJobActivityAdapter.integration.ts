import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AI job -> activity adapter", function () {
  it("turns a completed AI job into a verified activity", async function () {
    const [owner, creator, agentOwner] = await ethers.getSigners();

    const token = await ethers.deployContract("MockERC20", ["Reward", "RWD", owner.address]);
    const runtime = await ethers.deployContract("AIAgentRuntime", [owner.address]);
    const engine = await ethers.deployContract("AIAgentEngine", [owner.address, token.target]);
    const registry = await ethers.deployContract("ActivityRegistry", [owner.address]);

    const activityType = ethers.id("AI_JOB_COMPLETED");
    const projectId = ethers.id("ARC_AI_HUB");
    const adapter = await ethers.deployContract("AIJobActivityAdapter", [
      owner.address,
      engine.target,
      runtime.target,
      registry.target,
      5042002n,
      activityType,
      projectId,
    ]);

    await registry.setActivityType(activityType, true);
    await registry.setReporter(adapter.target, true);

    await runtime.connect(agentOwner).registerAgent(
      "Test Agent",
      "https://example.invalid/agent",
      "ipfs://metadata",
      "1.0.0",
    );

    await token.mint(creator.address, 100n);
    await token.connect(creator).approve(engine.target, 100n);
    await engine.connect(creator).createJob(0, "run test task", 100n);
    await engine.assignJob(0);
    await engine.completeJob(0);

    await adapter.reportCompletedJob(0, ethers.id("job-metadata"));

    const sourceActivityId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["AI_JOB", 0n]),
    );
    const activityId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32", "bytes32", "bytes32"],
        [agentOwner.address, 5042002n, activityType, projectId, sourceActivityId],
      ),
    );

    const activity = await registry.getActivity(activityId);
    expect(activity.user).to.equal(agentOwner.address);
    expect(activity.activityType).to.equal(activityType);
    expect(activity.verified).to.equal(true);
  });
});
