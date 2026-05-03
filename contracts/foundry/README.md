# Successor — Foundry

Production-ready Foundry project for the **Successor** autonomous will executor contract, targeting the [0G Chain](https://0g.ai) EVM-compatible network.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Project structure](#project-structure)
4. [Build](#build)
5. [Test](#test)
6. [Gas snapshot](#gas-snapshot)
7. [Deploy](#deploy)
8. [Verify on 0G Explorer](#verify-on-0g-explorer)
9. [Contract overview](#contract-overview)
10. [Environment variables](#environment-variables)

---

## Prerequisites

- **Foundry** — install with the official installer:

  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

  Verify:

  ```bash
  forge --version   # forge 0.2.x (...)
  cast --version
  anvil --version
  ```

- **Git** — required for forge dependency management via submodules.

---

## Installation

```bash
# 1. Clone / enter the project
cd contracts/foundry

# 2. Install forge-std (the only dependency)
forge install foundry-rs/forge-std --no-commit

# 3. Copy and fill in the environment file
cp .env.example .env
# Edit .env with your PRIVATE_KEY, KIN_ADDRESS, etc.
```

> **No npm, no node_modules.** Foundry manages dependencies as git submodules under `lib/`.

---

## Project structure

```
contracts/foundry/
├── foundry.toml          # Foundry configuration
├── src/
│   └── Successor.sol     # Main contract
├── test/
│   └── Successor.t.sol   # Full test suite (unit + fuzz)
├── script/
│   └── Deploy.s.sol      # Deployment script
├── lib/
│   └── forge-std/        # forge-std (git submodule)
├── .env.example
└── README.md
```

---

## Build

```bash
forge build
```

Expected output:

```
[⠒] Compiling...
[⠃] Compiling 2 files with 0.8.19
[⠊] Solc 0.8.19 finished in X.XXs
Compiler run successful!
```

---

## Test

### Run all tests

```bash
forge test
```

### Verbose output (show logs and traces)

```bash
forge test -vvv
```

### Run a specific test

```bash
forge test --match-test test_e2e_fullLifecycle -vvv
```

### Run a specific test contract

```bash
forge test --match-contract SuccessorTest -vv
```

### Run only fuzz tests

```bash
forge test --match-test testFuzz -vv
```

### Adjust fuzz runs (default 256)

```bash
forge test --fuzz-runs 10000
```

### Watch mode (re-run on file save)

```bash
forge test --watch
```

### Expected output

```
Running 36 tests for test/Successor.t.sol:SuccessorTest
[PASS] test_deployment_setsParams() (gas: ...)
[PASS] test_deployment_lastPingIsNow() (gas: ...)
[PASS] test_ping_updatesLastPing() (gas: ...)
...
[PASS] test_e2e_fullLifecycle() (gas: ...)
[PASS] testFuzz_verifyDeath_respectsGracePeriod(uint256,uint256) (runs: 256, ...)
[PASS] testFuzz_ping_alwaysUpdatesTimestamp(uint256) (runs: 256, ...)
[PASS] testFuzz_spendLimit_enforcement(uint256,uint256,uint256) (runs: 256, ...)
Test result: ok. 36 passed; 0 failed; finished in Xs
```

---

## Gas snapshot

Generate a gas usage report for all tests:

```bash
forge snapshot
```

This writes `.gas-snapshot`. To compare against a previous snapshot:

```bash
forge snapshot --diff
```

---

## Deploy

### 1. Local anvil node (dry-run / development)

```bash
# Terminal 1 – start a local chain
anvil

# Terminal 2 – deploy (no broadcast flag = simulation only)
source .env
forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --private-key $PRIVATE_KEY
```

### 2. 0G Chain testnet (live broadcast)

```bash
source .env

forge script script/Deploy.s.sol \
  --rpc-url $ZG_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --slow
```

The `--slow` flag sends transactions one at a time, which is safer on public testnets.

Deployment artifacts (including the contract address) are saved to:

```
broadcast/Deploy.s.sol/<chainId>/run-latest.json
```

Extract the deployed address:

```bash
cat broadcast/Deploy.s.sol/16600/run-latest.json \
  | jq -r '.transactions[0].contractAddress'
```

### 3. Override parameters at deploy time

```bash
KIN_ADDRESS=0xYourKin \
GRACE_PERIOD_DAYS=14 \
DAILY_SPEND_LIMIT_WEI=2000000000000000000 \
forge script script/Deploy.s.sol \
  --rpc-url $ZG_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

---

## Verify on 0G Explorer

0G Chain uses a **Blockscout**-compatible explorer. Verification is done via the Blockscout API:

```bash
source .env

DEPLOYED_ADDRESS=0x...   # from broadcast/Deploy.s.sol/.../run-latest.json

forge verify-contract $DEPLOYED_ADDRESS \
  src/Successor.sol:Successor \
  --verifier blockscout \
  --verifier-url "$ZG_EXPLORER_URL/api" \
  --constructor-args $(cast abi-encode \
      "constructor(address,uint256,uint256)" \
      $KIN_ADDRESS \
      $((GRACE_PERIOD_DAYS * 86400)) \
      $DAILY_SPEND_LIMIT_WEI) \
  --compiler-version 0.8.19 \
  --chain-id 16600
```

Or pass `--verify` directly to the deploy script (requires `ZG_EXPLORER_URL` and `ZG_EXPLORER_API_KEY` set in `.env`):

```bash
forge script script/Deploy.s.sol \
  --rpc-url $ZG_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url $ZG_EXPLORER_URL/api
```

---

## Contract overview

| Function | Access | Description |
|---|---|---|
| `ping()` | owner | Reset the heartbeat timer. |
| `setGracePeriod(uint256)` | owner | Update grace period (pre-trigger only). |
| `setKinAddress(address)` | owner | Update next-of-kin wallet (pre-trigger only). |
| `setDailySpendLimit(uint256)` | owner | Update daily spend limit (pre-trigger only). |
| `addInstruction(...)` | owner | Append an instruction to the queue (pre-trigger only). |
| `removeInstruction(uint256)` | owner | Remove an instruction by index (pre-trigger only). |
| `reorderInstructions(uint256,uint256)` | owner | Swap two instructions (pre-trigger only). |
| `verifyDeath()` | kin | Verify death and transition to EXECUTING (after grace period). |
| `executeAll()` | anyone | Execute all queued instructions (EXECUTING state only). |
| `executeOne(uint256)` | anyone | Execute a single instruction by index (EXECUTING state only). |
| `getStatus()` | view | Returns triggered, state, timeRemaining, totalInstructions. |
| `instructionCount()` | view | Returns the number of queued instructions. |
| `remainingDailyAllowance()` | view | Returns remaining spend allowance for the current 24 h window. |

### Lifecycle states

```
ACTIVE ──(grace elapsed + verifyDeath())──► EXECUTING ──(executeAll())──► COMPLETED
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PRIVATE_KEY` | ✅ | — | Deployer private key (0x-prefixed). |
| `KIN_ADDRESS` | ✅ | — | Next-of-kin wallet address. |
| `GRACE_PERIOD_DAYS` | ❌ | `7` | Grace period in days. |
| `DAILY_SPEND_LIMIT_WEI` | ❌ | `1000000000000000000` | Daily spend limit in wei. `0` = unlimited. |
| `ZG_RPC_URL` | ✅ (deploy) | — | 0G Chain RPC endpoint. |
| `ZG_EXPLORER_URL` | ❌ | — | Block explorer base URL for verification. |
| `ZG_EXPLORER_API_KEY` | ❌ | — | Explorer API key (if required). |

---

## 0G Chain network details

| Parameter | Value |
|---|---|
| Chain ID | `16600` |
| RPC | `https://rpc-testnet.0g.ai` |
| Explorer | `https://testnet.0gscan.ai` |
| Native token | ZG |
| EVM version | Paris (compatible with Solidity 0.8.19) |
