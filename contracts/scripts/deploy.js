/**
 * deploy.js – Hardhat deployment script for Successor.sol
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network 0g-testnet
 *
 * Required env vars (in ../.env):
 *   DEPLOYER_PRIVATE_KEY   – deployer wallet private key (0x-prefixed)
 *   KIN_ADDRESS            – next-of-kin wallet address
 *   GRACE_PERIOD_DAYS      – grace period in days (default: 7)
 *   DAILY_SPEND_LIMIT_ZG   – daily spend limit in ZG (default: 1.0)
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ZG"
  );

  // ── Parameters ──────────────────────────────────────────────────────────────

  const kinAddress = process.env.KIN_ADDRESS;
  if (!kinAddress || !ethers.isAddress(kinAddress)) {
    throw new Error("KIN_ADDRESS env var is missing or invalid");
  }

  const gracePeriodDays = Number(process.env.GRACE_PERIOD_DAYS ?? "7");
  const gracePeriodSecs = gracePeriodDays * 24 * 60 * 60;

  const dailyLimitZg = process.env.DAILY_SPEND_LIMIT_ZG ?? "1.0";
  const dailyLimitWei = ethers.parseEther(dailyLimitZg);

  console.log("\nDeployment parameters:");
  console.log("  kinAddress     :", kinAddress);
  console.log("  gracePeriod    :", gracePeriodSecs, "seconds (", gracePeriodDays, "days )");
  console.log("  dailySpendLimit:", ethers.formatEther(dailyLimitWei), "ZG");

  // ── Deploy ──────────────────────────────────────────────────────────────────

  const Factory = await ethers.getContractFactory("Successor");
  const successor = await Factory.deploy(kinAddress, gracePeriodSecs, dailyLimitWei);
  await successor.waitForDeployment();

  const address = await successor.getAddress();
  console.log("\n✅ Successor deployed to:", address);
  console.log("   Network  :", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID :", (await ethers.provider.getNetwork()).chainId.toString());

  // ── Verify deployment ───────────────────────────────────────────────────────

  const { currentState, timeRemaining } = await successor.getStatus();
  console.log("\nInitial status:");
  console.log("  state        :", ["ACTIVE","TRIGGERED","EXECUTING","COMPLETED"][Number(currentState)]);
  console.log("  timeRemaining:", timeRemaining.toString(), "seconds");

  console.log("\nNext steps:");
  console.log("  1. Fund the contract: send ZG to", address);
  console.log("  2. Add instructions via addInstruction()");
  console.log("  3. Call ping() regularly to maintain the heartbeat");
  console.log("  4. If heartbeat is missed, kin calls verifyDeath() then executeAll()");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
