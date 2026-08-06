import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

const ARC_TESTNET = 5042002n;

describe("AI Hub reward flow", function () {
  it("runs verified activity -> policy -> eligibility -> points -> native reward", async function () {
    const [owner, reporter, user] = await ethers.getSigners();

    const registry = await ethers.deployContract("ActivityRegistry", [owner.address]);
    const points = await ethers.deployContract("PointsLedger", [owner.address]);
    const eligibility = await ethers.deployContract("EligibilityEngine", [owner.address]);
    const policy = await ethers.deployContract("RewardPolicyEngine", [owner.address, registry.target]);
    const rewards = await ethers.deployContract("RewardEngine", [
      owner.address,
      registry.target,
      policy.target,
      points.target,
      eligibility.target,
    ]);

    const activityType = ethers.id("AI_JOB_COMPLETED");
    const projectId = ethers.id("ARC_AI_HUB");
    const sourceActivityId = ethers.id("JOB_001");
    const policyId = ethers.id("AI_JOB_REWARD");
    const claimId = ethers.id("CLAIM_001");
    const reward = ethers.parseEther("0.05");

    await registry.setActivityType(activityType, true);
    await registry.setReporter(reporter.address, true);
    await policy.setClaimer(rewards.target, true);
    await points.setWriter(rewards.target, true);
    await eligibility.setConsumer(rewards.target, true);

    await policy.setPolicy(policyId, activityType, ARC_TESTNET, 100n, reward, true, true);
    await eligibility.setRule(policyId, 0, 1, 0, true, true);

    const tx = await registry.connect(reporter).recordActivity(
      user.address,
      ARC_TESTNET,
      activityType,
      projectId,
      sourceActivityId,
      ethers.id("metadata"),
      true,
    );
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    const activityId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32", "bytes32", "bytes32"],
        [user.address, ARC_TESTNET, activityType, projectId, sourceActivityId],
      ),
    );

    await owner.sendTransaction({ to: rewards.target, value: reward });

    const before = await ethers.provider.getBalance(user.address);
    await rewards.executeNative(claimId, policyId, activityId, user.address);
    const after = await ethers.provider.getBalance(user.address);

    expect(after - before).to.equal(reward);
    expect(await points.pointsOf(user.address)).to.equal(100n);
    expect(await points.credited(user.address, activityId)).to.equal(true);
    expect(await policy.userClaimed(policyId, user.address)).to.equal(true);
    expect(await rewards.executed(claimId)).to.equal(true);
  });

  it("rejects unverified activity when policy requires verification", async function () {
    const [owner, reporter, user] = await ethers.getSigners();

    const registry = await ethers.deployContract("ActivityRegistry", [owner.address]);
    const points = await ethers.deployContract("PointsLedger", [owner.address]);
    const eligibility = await ethers.deployContract("EligibilityEngine", [owner.address]);
    const policy = await ethers.deployContract("RewardPolicyEngine", [owner.address, registry.target]);
    const rewards = await ethers.deployContract("RewardEngine", [
      owner.address,
      registry.target,
      policy.target,
      points.target,
      eligibility.target,
    ]);

    const activityType = ethers.id("SWAP");
    const projectId = ethers.id("ARC_AI_HUB");
    const sourceActivityId = ethers.id("TX_002");
    const policyId = ethers.id("VERIFIED_SWAP");
    const claimId = ethers.id("CLAIM_002");

    await registry.setActivityType(activityType, true);
    await registry.setReporter(reporter.address, true);
    await policy.setClaimer(rewards.target, true);
    await points.setWriter(rewards.target, true);
    await eligibility.setConsumer(rewards.target, true);
    await policy.setPolicy(policyId, activityType, ARC_TESTNET, 50n, 1n, true, true);
    await eligibility.setRule(policyId, 0, 1, 0, true, true);

    await registry.connect(reporter).recordActivity(
      user.address,
      ARC_TESTNET,
      activityType,
      projectId,
      sourceActivityId,
      ethers.id("metadata"),
      false,
    );

    const activityId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32", "bytes32", "bytes32"],
        [user.address, ARC_TESTNET, activityType, projectId, sourceActivityId],
      ),
    );

    await expect(
      rewards.executeNative(claimId, policyId, activityId, user.address),
    ).to.be.revertedWithCustomError(policy, "VerificationRequired");

    expect(await points.pointsOf(user.address)).to.equal(0n);
  });
});
