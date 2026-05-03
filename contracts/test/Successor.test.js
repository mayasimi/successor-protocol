/**
 * Successor.test.js
 * Hardhat (ethers v6) test suite for the Successor contract.
 *
 * Run:
 *   npx hardhat test contracts/test/Successor.test.js
 *
 * Or with gas reporting:
 *   REPORT_GAS=true npx hardhat test contracts/test/Successor.test.js
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { time }        = require("@nomicfoundation/hardhat-network-helpers");

// ─── Constants ────────────────────────────────────────────────────────────────

const GRACE_PERIOD      = 7 * 24 * 60 * 60;   // 7 days in seconds
const DAILY_LIMIT       = ethers.parseEther("1.0"); // 1 ZG per day
const ONE_DAY           = 24 * 60 * 60;

// State enum mirrors the Solidity enum
const State = { ACTIVE: 0n, TRIGGERED: 1n, EXECUTING: 2n, COMPLETED: 3n };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deploy a fresh Successor contract. */
async function deploy(owner, kin, gracePeriod = GRACE_PERIOD, dailyLimit = DAILY_LIMIT) {
  const Factory = await ethers.getContractFactory("Successor", owner);
  const contract = await Factory.deploy(kin.address, gracePeriod, dailyLimit);
  await contract.waitForDeployment();
  return contract;
}

/** Advance chain time past the grace period and mine a block. */
async function elapseGracePeriod(contract) {
  const gp = await contract.gracePeriod();
  await time.increase(Number(gp) + 1);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Successor", function () {
  let owner, kin, stranger, recipient;
  let successor;

  beforeEach(async function () {
    [owner, kin, stranger, recipient] = await ethers.getSigners();
    successor = await deploy(owner, kin);
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets owner, kin, gracePeriod, dailySpendLimit correctly", async function () {
      expect(await successor.owner()).to.equal(owner.address);
      expect(await successor.kinAddress()).to.equal(kin.address);
      expect(await successor.gracePeriod()).to.equal(GRACE_PERIOD);
      expect(await successor.dailySpendLimit()).to.equal(DAILY_LIMIT);
    });

    it("starts in ACTIVE state", async function () {
      const { currentState } = await successor.getStatus();
      expect(currentState).to.equal(State.ACTIVE);
    });

    it("reverts on zero kin address", async function () {
      const Factory = await ethers.getContractFactory("Successor", owner);
      await expect(
        Factory.deploy(ethers.ZeroAddress, GRACE_PERIOD, DAILY_LIMIT)
      ).to.be.revertedWithCustomError(successor, "ZeroAddress");
    });

    it("reverts on zero grace period", async function () {
      const Factory = await ethers.getContractFactory("Successor", owner);
      await expect(
        Factory.deploy(kin.address, 0, DAILY_LIMIT)
      ).to.be.revertedWithCustomError(successor, "ZeroGracePeriod");
    });
  });

  // ── Heartbeat ───────────────────────────────────────────────────────────────

  describe("ping()", function () {
    it("resets lastPing and emits HeartbeatPing", async function () {
      await time.increase(1000);
      const tx = await successor.connect(owner).ping();
      const block = await ethers.provider.getBlock(tx.blockNumber);

      await expect(tx)
        .to.emit(successor, "HeartbeatPing")
        .withArgs(owner.address, block.timestamp);

      expect(await successor.lastPing()).to.equal(block.timestamp);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        successor.connect(stranger).ping()
      ).to.be.revertedWithCustomError(successor, "NotOwner");
    });

    it("reverts after grace period elapses and verifyDeath is called", async function () {
      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
      await expect(
        successor.connect(owner).ping()
      ).to.be.revertedWithCustomError(successor, "AlreadyTriggered");
    });
  });

  // ── Configuration ───────────────────────────────────────────────────────────

  describe("setGracePeriod()", function () {
    it("updates grace period and emits event", async function () {
      const newPeriod = 14 * 24 * 60 * 60;
      await expect(successor.connect(owner).setGracePeriod(newPeriod))
        .to.emit(successor, "GracePeriodChanged")
        .withArgs(GRACE_PERIOD, newPeriod);
      expect(await successor.gracePeriod()).to.equal(newPeriod);
    });

    it("reverts on zero", async function () {
      await expect(
        successor.connect(owner).setGracePeriod(0)
      ).to.be.revertedWithCustomError(successor, "ZeroGracePeriod");
    });

    it("reverts after trigger", async function () {
      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
      await expect(
        successor.connect(owner).setGracePeriod(1000)
      ).to.be.revertedWithCustomError(successor, "AlreadyTriggered");
    });
  });

  describe("setKinAddress()", function () {
    it("updates kin and emits KinAddressChanged", async function () {
      await expect(successor.connect(owner).setKinAddress(stranger.address))
        .to.emit(successor, "KinAddressChanged")
        .withArgs(kin.address, stranger.address);
      expect(await successor.kinAddress()).to.equal(stranger.address);
    });

    it("reverts on zero address", async function () {
      await expect(
        successor.connect(owner).setKinAddress(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(successor, "ZeroAddress");
    });
  });

  describe("setDailySpendLimit()", function () {
    it("updates limit and emits SpendLimitChanged", async function () {
      const newLimit = ethers.parseEther("2.0");
      await expect(successor.connect(owner).setDailySpendLimit(newLimit))
        .to.emit(successor, "SpendLimitChanged")
        .withArgs(DAILY_LIMIT, newLimit);
      expect(await successor.dailySpendLimit()).to.equal(newLimit);
    });
  });

  // ── Instructions ────────────────────────────────────────────────────────────

  describe("addInstruction()", function () {
    it("appends an instruction and emits InstructionAdded", async function () {
      const data = "0x";
      await expect(
        successor.connect(owner).addInstruction(
          recipient.address, data, 0, "Send greeting"
        )
      )
        .to.emit(successor, "InstructionAdded")
        .withArgs(0, recipient.address, data, 0, "Send greeting");

      expect(await successor.instructionCount()).to.equal(1);
    });

    it("reverts on zero target address", async function () {
      await expect(
        successor.connect(owner).addInstruction(
          ethers.ZeroAddress, "0x", 0, "bad"
        )
      ).to.be.revertedWithCustomError(successor, "ZeroAddress");
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        successor.connect(stranger).addInstruction(
          recipient.address, "0x", 0, "hack"
        )
      ).to.be.revertedWithCustomError(successor, "NotOwner");
    });
  });

  describe("removeInstruction()", function () {
    beforeEach(async function () {
      // Add three instructions: A, B, C
      for (const label of ["A", "B", "C"]) {
        await successor.connect(owner).addInstruction(
          recipient.address, "0x", 0, label
        );
      }
    });

    it("removes middle instruction and shifts remaining", async function () {
      await expect(successor.connect(owner).removeInstruction(1))
        .to.emit(successor, "InstructionRemoved")
        .withArgs(1);

      expect(await successor.instructionCount()).to.equal(2);
      const [, , , descA] = await successor.instructions(0);
      const [, , , descC] = await successor.instructions(1);
      expect(descA).to.equal("A");
      expect(descC).to.equal("C");
    });

    it("reverts on out-of-bounds index", async function () {
      await expect(
        successor.connect(owner).removeInstruction(99)
      ).to.be.revertedWithCustomError(successor, "InstructionIndexOutOfBounds");
    });
  });

  describe("reorderInstructions()", function () {
    beforeEach(async function () {
      await successor.connect(owner).addInstruction(recipient.address, "0x", 0, "First");
      await successor.connect(owner).addInstruction(recipient.address, "0x", 0, "Second");
    });

    it("swaps two instructions", async function () {
      await successor.connect(owner).reorderInstructions(0, 1);
      const [, , , desc0] = await successor.instructions(0);
      const [, , , desc1] = await successor.instructions(1);
      expect(desc0).to.equal("Second");
      expect(desc1).to.equal("First");
    });

    it("no-ops when indexA === indexB", async function () {
      await expect(
        successor.connect(owner).reorderInstructions(0, 0)
      ).to.not.be.reverted;
    });
  });

  // ── Death verification ───────────────────────────────────────────────────────

  describe("verifyDeath()", function () {
    it("reverts when grace period has not elapsed", async function () {
      await expect(
        successor.connect(kin).verifyDeath()
      ).to.be.revertedWithCustomError(successor, "GracePeriodNotElapsed");
    });

    it("reverts when called by non-kin", async function () {
      await elapseGracePeriod(successor);
      await expect(
        successor.connect(stranger).verifyDeath()
      ).to.be.revertedWithCustomError(successor, "NotKin");
    });

    it("transitions to EXECUTING and emits DeathVerified", async function () {
      await elapseGracePeriod(successor);
      const tx = await successor.connect(kin).verifyDeath();
      const block = await ethers.provider.getBlock(tx.blockNumber);

      await expect(tx)
        .to.emit(successor, "DeathVerified")
        .withArgs(kin.address, block.timestamp);

      const { currentState } = await successor.getStatus();
      expect(currentState).to.equal(State.EXECUTING);
    });

    it("reverts if already in EXECUTING state", async function () {
      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
      await expect(
        successor.connect(kin).verifyDeath()
      ).to.be.revertedWithCustomError(successor, "AlreadyTriggered");
    });
  });

  // ── getStatus() ─────────────────────────────────────────────────────────────

  describe("getStatus()", function () {
    it("returns triggered=false and positive timeRemaining before grace period", async function () {
      const { triggered, timeRemaining } = await successor.getStatus();
      expect(triggered).to.be.false;
      expect(timeRemaining).to.be.gt(0n);
    });

    it("returns triggered=true and timeRemaining=0 after grace period", async function () {
      await elapseGracePeriod(successor);
      const { triggered, timeRemaining } = await successor.getStatus();
      expect(triggered).to.be.true;
      expect(timeRemaining).to.equal(0n);
    });
  });

  // ── Execution ───────────────────────────────────────────────────────────────

  describe("executeAll()", function () {
    beforeEach(async function () {
      // Fund the contract
      await owner.sendTransaction({
        to: await successor.getAddress(),
        value: ethers.parseEther("5.0"),
      });

      // Add a value-bearing instruction and a zero-value instruction
      await successor.connect(owner).addInstruction(
        recipient.address,
        "0x",
        ethers.parseEther("0.5"),
        "Send 0.5 ZG"
      );
      await successor.connect(owner).addInstruction(
        recipient.address,
        "0x",
        0,
        "Ping recipient"
      );

      // Trigger
      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
    });

    it("reverts when not in EXECUTING state", async function () {
      // Deploy a fresh contract (ACTIVE state)
      const fresh = await deploy(owner, kin);
      await expect(
        fresh.connect(stranger).executeAll()
      ).to.be.revertedWithCustomError(fresh, "NotInExecutingState");
    });

    it("executes all instructions and transitions to COMPLETED", async function () {
      const recipientBefore = await ethers.provider.getBalance(recipient.address);

      const tx = await successor.connect(stranger).executeAll();

      // Both instructions should emit InstructionExecuted
      await expect(tx).to.emit(successor, "InstructionExecuted").withArgs(0, true, "0x");
      await expect(tx).to.emit(successor, "InstructionExecuted").withArgs(1, true, "0x");
      await expect(tx).to.emit(successor, "ExecutionCompleted");

      const { currentState } = await successor.getStatus();
      expect(currentState).to.equal(State.COMPLETED);

      const recipientAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientAfter - recipientBefore).to.equal(ethers.parseEther("0.5"));
    });

    it("skips already-executed instructions on second call", async function () {
      await successor.connect(stranger).executeAll();
      // Second call should not revert (instructions are skipped) but state is COMPLETED
      // so it will revert with NotInExecutingState
      await expect(
        successor.connect(stranger).executeAll()
      ).to.be.revertedWithCustomError(successor, "NotInExecutingState");
    });
  });

  // ── Daily spend limit ────────────────────────────────────────────────────────

  describe("Daily spend limit", function () {
    beforeEach(async function () {
      // Fund contract with 10 ZG
      await owner.sendTransaction({
        to: await successor.getAddress(),
        value: ethers.parseEther("10.0"),
      });

      // Add two instructions each spending 0.8 ZG (total 1.6 > 1.0 limit)
      await successor.connect(owner).addInstruction(
        recipient.address, "0x", ethers.parseEther("0.8"), "First 0.8"
      );
      await successor.connect(owner).addInstruction(
        recipient.address, "0x", ethers.parseEther("0.8"), "Second 0.8"
      );

      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
    });

    it("records second instruction as failed when limit is exceeded", async function () {
      const tx = await successor.connect(stranger).executeAll();

      // First instruction succeeds
      await expect(tx).to.emit(successor, "InstructionExecuted").withArgs(0, true, "0x");
      // Second instruction fails (limit exceeded)
      await expect(tx)
        .to.emit(successor, "InstructionExecuted")
        .withArgs(1, false, ethers.toUtf8Bytes("DailySpendLimitExceeded"));
    });

    it("resets window after 24 hours and allows spending again via executeOne", async function () {
      // Execute first instruction (0.8 ZG spent)
      await successor.connect(stranger).executeOne(0);

      // Advance 24 hours to reset the window
      await time.increase(ONE_DAY + 1);

      // Now execute the second instruction – window has reset, 0.8 < 1.0 limit
      const tx = await successor.connect(stranger).executeOne(1);
      await expect(tx).to.emit(successor, "InstructionExecuted").withArgs(1, true, "0x");
    });

    it("remainingDailyAllowance returns max when limit is zero", async function () {
      const fresh = await deploy(owner, kin, GRACE_PERIOD, 0);
      expect(await fresh.remainingDailyAllowance()).to.equal(ethers.MaxUint256);
    });
  });

  // ── executeOne() ─────────────────────────────────────────────────────────────

  describe("executeOne()", function () {
    beforeEach(async function () {
      await owner.sendTransaction({
        to: await successor.getAddress(),
        value: ethers.parseEther("2.0"),
      });
      await successor.connect(owner).addInstruction(
        recipient.address, "0x", ethers.parseEther("0.1"), "Single"
      );
      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();
    });

    it("executes a single instruction by index", async function () {
      await expect(successor.connect(stranger).executeOne(0))
        .to.emit(successor, "InstructionExecuted")
        .withArgs(0, true, "0x");
    });

    it("reverts on out-of-bounds index", async function () {
      await expect(
        successor.connect(stranger).executeOne(99)
      ).to.be.revertedWithCustomError(successor, "InstructionIndexOutOfBounds");
    });
  });

  // ── Reentrancy guard ─────────────────────────────────────────────────────────

  describe("Reentrancy protection", function () {
    it("blocks reentrant calls via a malicious target", async function () {
      // Deploy a simple re-entrant attacker
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker", owner);
      const attacker = await AttackerFactory.deploy(await successor.getAddress());
      await attacker.waitForDeployment();

      await owner.sendTransaction({
        to: await successor.getAddress(),
        value: ethers.parseEther("2.0"),
      });

      // Add instruction targeting the attacker
      await successor.connect(owner).addInstruction(
        await attacker.getAddress(),
        "0x",
        ethers.parseEther("0.1"),
        "Attacker"
      );

      await elapseGracePeriod(successor);
      await successor.connect(kin).verifyDeath();

      // executeAll should succeed but the attacker's reentrant call is blocked
      // The instruction itself may succeed (attacker receives ETH) but the
      // reentrant executeAll inside the attacker's receive() will revert.
      // The outer executeAll should still complete without reverting.
      await expect(
        successor.connect(stranger).executeAll()
      ).to.not.be.reverted;
    });
  });

  // ── Full end-to-end flow ──────────────────────────────────────────────────────

  describe("End-to-end flow", function () {
    it("complete lifecycle: deploy → ping → add instructions → verify → execute", async function () {
      // 1. Fund
      await owner.sendTransaction({
        to: await successor.getAddress(),
        value: ethers.parseEther("3.0"),
      });

      // 2. Owner pings a few times
      await time.increase(1000);
      await successor.connect(owner).ping();
      await time.increase(1000);
      await successor.connect(owner).ping();

      // 3. Add instructions
      await successor.connect(owner).addInstruction(
        recipient.address, "0x", ethers.parseEther("0.5"), "Transfer 0.5 ZG"
      );
      await successor.connect(owner).addInstruction(
        recipient.address, "0x", 0, "Notify"
      );

      // 4. Status should still be ACTIVE
      let status = await successor.getStatus();
      expect(status.triggered).to.be.false;
      expect(status.currentState).to.equal(State.ACTIVE);

      // 5. Owner stops pinging – grace period elapses
      await elapseGracePeriod(successor);

      status = await successor.getStatus();
      expect(status.triggered).to.be.true;

      // 6. Kin verifies death
      await successor.connect(kin).verifyDeath();
      status = await successor.getStatus();
      expect(status.currentState).to.equal(State.EXECUTING);

      // 7. Execute all
      const recipientBefore = await ethers.provider.getBalance(recipient.address);
      await successor.connect(stranger).executeAll();

      const recipientAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientAfter - recipientBefore).to.equal(ethers.parseEther("0.5"));

      status = await successor.getStatus();
      expect(status.currentState).to.equal(State.COMPLETED);
    });
  });
});
