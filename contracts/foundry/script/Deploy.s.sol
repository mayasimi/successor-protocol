// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {Successor} from "../src/Successor.sol";

/**
 * @title  Deploy
 * @notice Foundry deployment script for Successor.sol.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 * Dry-run (no broadcast):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ZG_RPC_URL \
 *     --private-key $PRIVATE_KEY
 *
 * Live broadcast to 0G testnet:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ZG_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --verifier blockscout \
 *     --verifier-url $ZG_EXPLORER_URL/api
 *
 * ── Environment variables ─────────────────────────────────────────────────────
 *
 *   PRIVATE_KEY              Deployer private key (0x-prefixed).
 *   KIN_ADDRESS              Next-of-kin wallet address.
 *   GRACE_PERIOD_DAYS        Grace period in days (default: 7).
 *   DAILY_SPEND_LIMIT_WEI    Daily spend limit in wei (default: 1 ether = 1e18).
 *                            Set to 0 for unlimited.
 *   ZG_RPC_URL               RPC endpoint (e.g. https://rpc-testnet.0g.ai).
 *   ZG_EXPLORER_URL          Block explorer base URL for verification.
 */
contract Deploy is Script {

    // ── Defaults ──────────────────────────────────────────────────────────────

    uint256 constant DEFAULT_GRACE_DAYS  = 7;
    uint256 constant DEFAULT_SPEND_LIMIT = 1 ether;

    // ── run() ─────────────────────────────────────────────────────────────────

    function run() external returns (Successor successor) {
        // ── Read parameters ───────────────────────────────────────────────────

        address kinAddress = vm.envAddress("KIN_ADDRESS");

        uint256 gracePeriodDays = _envUintOr("GRACE_PERIOD_DAYS", DEFAULT_GRACE_DAYS);
        uint256 gracePeriodSecs = gracePeriodDays * 1 days;

        uint256 dailySpendLimit = _envUintOr("DAILY_SPEND_LIMIT_WEI", DEFAULT_SPEND_LIMIT);

        // ── Log parameters ────────────────────────────────────────────────────

        console2.log("=== Successor Deployment ===");
        console2.log("  kinAddress      :", kinAddress);
        console2.log("  gracePeriod     :", gracePeriodSecs, "seconds");
        console2.log("  gracePeriodDays :", gracePeriodDays, "days");
        console2.log("  dailySpendLimit :", dailySpendLimit, "wei");

        // ── Deploy ────────────────────────────────────────────────────────────

        vm.startBroadcast();

        successor = new Successor(
            kinAddress,
            gracePeriodSecs,
            dailySpendLimit
        );

        vm.stopBroadcast();

        // ── Post-deploy summary ───────────────────────────────────────────────

        console2.log("");
        console2.log("=== Deployed ===");
        console2.log("  Successor       :", address(successor));
        console2.log("  owner           :", successor.owner());
        console2.log("  kinAddress      :", successor.kinAddress());
        console2.log("  gracePeriod     :", successor.gracePeriod(), "seconds");
        console2.log("  dailySpendLimit :", successor.dailySpendLimit(), "wei");
        console2.log("  state           : ACTIVE");
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Fund the contract: cast send", address(successor), "--value 1ether --private-key $PRIVATE_KEY --rpc-url $ZG_RPC_URL");
        console2.log("  2. Add instructions via addInstruction()");
        console2.log("  3. Call ping() regularly to maintain the heartbeat");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// @dev Returns the env var as uint256, or `defaultVal` if not set / empty.
    function _envUintOr(string memory key, uint256 defaultVal)
        internal
        view
        returns (uint256)
    {
        try vm.envUint(key) returns (uint256 val) {
            return val;
        } catch {
            return defaultVal;
        }
    }
}
