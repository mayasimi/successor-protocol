# ⌛ Successor – Autonomous Will Executor on 0G Chain

> **Your will, executed autonomously. On-chain heartbeat. Verifiable. Trustless.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C)](https://book.getfoundry.sh/)
[![0G Chain](https://img.shields.io/badge/Network-0G%20Galileo%20Testnet-blue)](https://docs.0g.ai/)

---

## Table of Contents

1. [Problem & Solution](#problem--solution)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture Overview](#architecture-overview)
5. [Prerequisites](#prerequisites)
6. [Installation & Setup](#installation--setup)
7. [Environment Variables](#environment-variables)
8. [Deploying the Smart Contract](#deploying-the-smart-contract)
9. [Verifying on Explorer](#verifying-on-explorer)
10. [Running the Frontend](#running-the-frontend)
11. [Testing](#testing)
12. [Usage Flow](#usage-flow)
13. [Contributing](#contributing)
14. [License](#license)

---

## Problem & Solution

### The Problem

Traditional wills are slow, expensive, and opaque. They rely on lawyers, courts, and trusted intermediaries — all of which introduce delay, cost, and the possibility of human error or fraud. There is no trustless mechanism to ensure that a person's digital assets and final instructions are executed exactly as intended, without requiring anyone to "trust" a third party.

### The Solution

Successor replaces the intermediary with code. An owner registers an **estate plan** on-chain and sets a **heartbeat interval** — a regular check-in that proves they are still alive and in control. If the owner stops sending heartbeats and the grace period expires, an off-chain agent (powered by **OpenClaw / Kite AI**) detects the lapse, emails the designated **next of kin**, and generates a cryptographically signed confirmation link. Once the kin confirms, the pre-set instructions — token transfers, notifications, and custom actions — are executed automatically and attested on-chain.

No lawyers. No courts. No trust required.

---

## Features

- **On-chain heartbeat** — Owner sends a lightweight transaction at a configurable interval (7, 14, 30, 60, or 90 days) to prove liveness.
- **Configurable grace period** — A buffer window after the heartbeat interval before execution is triggered, preventing false positives.
- **Execution eligibility check** — The contract exposes `isExecutionEligible()` so any party can verify on-chain whether the trigger condition has been met.
- **Email-based next-of-kin confirmation** — The off-chain agent emails a unique, HMAC-signed confirmation link to the registered beneficiary.
- **Instruction queue** — Owners define a prioritised list of instructions (USDC transfers, notifications, webhook calls) that execute in sequence.
- **USDC transfers** — Native support for sending ERC-20 USDC to beneficiary addresses upon trigger.
- **Webhook actions** — Custom service actions can be delivered to any HTTPS endpoint via `SUCCESSOR_ACTION_WEBHOOK_URL`.
- **On-chain attestations** — Every agent action is attested on-chain via `DeadMansAgentRegistry.attest()`, creating an immutable audit trail.
- **Mock mode** — The agent runs fully in mock mode without a live Kite AI connection, making local development frictionless.
- **Wallet-gated dashboard** — MetaMask / injected wallet required to interact with the contract; auth state is persisted via Zustand.
- **0G Chain storage** — Plan metadata and agent state are anchored to 0G's permanent decentralised storage layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | [Next.js 14](https://nextjs.org/) (App Router, TypeScript) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Web3 / wallet | [Wagmi v2](https://wagmi.sh/), [Viem v2](https://viem.sh/), injected connector (MetaMask) |
| State management | [Zustand v4](https://zustand-demo.pmnd.rs/) with `persist` middleware |
| Smart contract | [Solidity 0.8.24](https://soliditylang.org/) |
| Contract toolchain | [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`, `anvil`) |
| Blockchain network | [0G Galileo Testnet](https://docs.0g.ai/) (Chain ID: 2368 / KiteAI Testnet) |
| Off-chain agent | [OpenClaw / Kite AI](https://gokite.ai/) — monitors heartbeats, sends email confirmations |
| Data validation | [Zod v3](https://zod.dev/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Owner's Browser                          │
│  Next.js 14 Frontend  ──  Wagmi / MetaMask  ──  Zustand Auth   │
└───────────────┬─────────────────────────────────────────────────┘
                │  REST API calls (Next.js API routes)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Layer (Node.js)                  │
│                                                                 │
│  POST /api/plans          – create estate plan                  │
│  POST /api/plans/:id/heartbeat  – record heartbeat             │
│  GET  /api/plans/:id/heartbeat  – fetch heartbeat status       │
│  POST /api/agent/run      – trigger off-chain agent (cron)     │
│  GET  /api/kin/confirm    – look up confirmation ref           │
│  POST /api/kin/confirm    – confirm next-of-kin identity       │
│  POST /api/attestations   – store attestation record           │
└───────────────┬─────────────────────────────────────────────────┘
                │  viem / ethers calls
                ▼
┌─────────────────────────────────────────────────────────────────┐
│           DeadMansAgentRegistry.sol  (0G Galileo Testnet)       │
│                                                                 │
│  registerPlan()       – owner registers plan on-chain          │
│  recordHeartbeat()    – owner proves liveness                  │
│  isExecutionEligible()– anyone checks if trigger is met        │
│  attest()             – agent writes immutable action proof    │
└─────────────────────────────────────────────────────────────────┘
                ▲
                │  reads isExecutionEligible(), writes attest()
┌─────────────────────────────────────────────────────────────────┐
│                  Off-chain Agent  (OpenClaw / Kite AI)          │
│                                                                 │
│  1. Cron calls POST /api/agent/run                             │
│  2. Agent reads all plans from local state                     │
│  3. For each overdue plan → emails next-of-kin with           │
│     HMAC-signed confirmation link                              │
│  4. On confirmation → executes instruction queue              │
│     (USDC transfer, webhook, notification)                     │
│  5. Writes attestation on-chain for every action              │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow summary:**

1. Owner signs up, connects MetaMask, and creates an estate plan.
2. Owner calls `registerPlan()` on-chain and sets beneficiaries + instructions off-chain.
3. Owner sends periodic heartbeats via the dashboard (calls `recordHeartbeat()` on-chain).
4. A cron job (or manual trigger) calls `POST /api/agent/run` with the agent secret.
5. The agent checks `isExecutionEligible()` for each plan. If `true`, it emails the next of kin.
6. The kin clicks the confirmation link (`/confirm-kin/:ref`), which calls `POST /api/kin/confirm`.
7. The agent executes the instruction queue and attests each action on-chain via `attest()`.

---

## Prerequisites

Before you begin, make sure you have the following installed and configured:

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v18 or later | `node --version` to check |
| [npm](https://www.npmjs.com/) | v9 or later | Bundled with Node.js |
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | latest | Install via `foundryup` |
| [MetaMask](https://metamask.io/) | latest browser extension | Or any injected EVM wallet |
| 0G Galileo testnet funds | — | Get test tokens from the [0G faucet](https://faucet.0g.ai/) |
| Git | any recent version | — |

**Install Foundry** (if not already installed):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify:

```bash
forge --version
cast --version
```

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/successor-protocol.git
cd successor-protocol
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install contract dependencies

The Solidity contract lives in `contracts/`. If you have a `foundry.toml` and `lib/` directory:

```bash
forge install
```

> If there is no `foundry.toml` yet, initialise Foundry in the project root:
> ```bash
> forge init --no-git --force
> ```

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

See the [Environment Variables](#environment-variables) section below for a full description of each variable.

---

## Environment Variables

Create `.env.local` in the project root for the Next.js frontend and API layer. For contract deployment, the same file (or a separate `.env`) is sourced by Foundry.

```dotenv
# ─── Off-chain agent ──────────────────────────────────────────────────────────

# Path to the JSON file used as the local state database
SUCCESSOR_DATA_PATH=.successor-data/state.json

# Secret used to authenticate cron calls to POST /api/agent/run
# Set the same value in your cron job's Authorization header or x-successor-agent-secret header
SUCCESSOR_AGENT_SECRET=change-me-for-cron

# HMAC secret used to sign and verify next-of-kin confirmation links
SUCCESSOR_ATTESTATION_SECRET=change-me-for-hmac-proofs

# Optional: HTTPS endpoint that receives action payloads (USDC transfers, notifications, etc.)
# Leave blank to run in mock mode
SUCCESSOR_ACTION_WEBHOOK_URL=

# ─── Kite AI / OpenClaw provider ─────────────────────────────────────────────

# Set to "mock" for local development; set to "live" to use real Kite AI
KITE_PROVIDER_MODE=mock

KITE_NETWORK=testnet
KITE_CHAIN_ID=2368
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
KITE_BLOCK_EXPLORER_URL=https://testnet.kitescan.ai

# Decentralised identity for the Successor agent
KITE_AGENT_ID=did:kite:successor-protocol/dead-mans-agent-v1

# Kite AI MCP and passport portal URLs
KITE_AGENT_PASSPORT_MCP_URL=https://neo.dev.gokite.ai/v1/mcp
KITE_PASSPORT_PORTAL_URL=https://x402-portal-eight.vercel.app/

# Private key of the agent wallet (used to call attest() on-chain)
# Never commit this value — use a dedicated agent wallet with minimal funds
KITE_AGENT_PRIVATE_KEY=

# Address of the deployed DeadMansAgentRegistry contract
KITE_ATTESTATION_CONTRACT_ADDRESS=

# Address of the USDC token contract on the target network
KITE_USDC_TOKEN_ADDRESS=

# ─── Frontend (public, safe to expose) ───────────────────────────────────────

# WalletConnect project ID — obtain from https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=

# Deployed contract address (same as KITE_ATTESTATION_CONTRACT_ADDRESS)
NEXT_PUBLIC_CONTRACT_ADDRESS=
```

> **Security note:** `KITE_AGENT_PRIVATE_KEY` is a hot wallet key. Use a dedicated wallet with only the gas funds needed for attestations. Never reuse your personal wallet key.

---

## Deploying the Smart Contract

The contract is `contracts/DeadMansAgentRegistry.sol`. Deployment targets the **0G Galileo Testnet** (Chain ID 2368, RPC `https://rpc-testnet.gokite.ai/`).

### Option A — `forge create` (quick deploy)

```bash
forge create contracts/DeadMansAgentRegistry.sol:DeadMansAgentRegistry \
  --rpc-url https://rpc-testnet.gokite.ai/ \
  --private-key $KITE_AGENT_PRIVATE_KEY \
  --broadcast
```

The command prints the deployed contract address. Copy it into your `.env.local`:

```dotenv
KITE_ATTESTATION_CONTRACT_ADDRESS=0xYourDeployedAddress
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedAddress
```

### Option B — `forge script` (recommended for reproducible deploys)

If a deployment script exists at `script/DeploySuccessor.s.sol`:

```bash
forge script script/DeploySuccessor.s.sol:DeploySuccessor \
  --rpc-url https://rpc-testnet.gokite.ai/ \
  --private-key $KITE_AGENT_PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://chainscan-galileo.0g.ai/api
```

> **Tip:** Add `--slow` if you hit nonce or mempool issues on the testnet.

### Confirming the deployment with `cast`

```bash
# Check the contract is live
cast code 0xYourDeployedAddress --rpc-url https://rpc-testnet.gokite.ai/

# Call a read function to verify ABI compatibility
cast call 0xYourDeployedAddress \
  "executionEligibleAt(bytes32)(uint256)" \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  --rpc-url https://rpc-testnet.gokite.ai/
```

---

## Verifying on Explorer

The 0G Galileo block explorer is at **[https://chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)**.

### Manual verification via the UI

1. Open `https://chainscan-galileo.0g.ai/address/0xYourDeployedAddress`.
2. Click the **Contract** tab → **Verify & Publish**.
3. Select **Solidity (Single file)**, compiler version `0.8.24`, optimisation off (or match your `foundry.toml` settings).
4. Paste the full source of `contracts/DeadMansAgentRegistry.sol` and submit.

### Automated verification via Foundry

```bash
forge verify-contract 0xYourDeployedAddress \
  contracts/DeadMansAgentRegistry.sol:DeadMansAgentRegistry \
  --chain-id 2368 \
  --verifier-url https://chainscan-galileo.0g.ai/api \
  --etherscan-api-key any_non_empty_string
```

> The explorer may accept any non-empty string as the API key for testnet verification.

---

## Running the Frontend

Make sure `.env.local` is populated (especially `NEXT_PUBLIC_CONTRACT_ADDRESS`), then:

```bash
npm run dev
```

The app starts at **[http://localhost:3000](http://localhost:3000)**.

| Route | Description |
|---|---|
| `/` | Landing page |
| `/signup` | Create an account (email + password, stored in Zustand) |
| `/login` | Sign in |
| `/dashboard` | Heartbeat status, countdown timer, active instructions |
| `/heartbeat` | Send / view heartbeat history |
| `/my-will` | Manage the instruction queue |
| `/next-of-kin` | Add / edit beneficiaries |
| `/attestations` | View on-chain attestation log |
| `/settings` | Account and plan settings |
| `/confirm-kin/:ref` | Next-of-kin confirmation page (linked from email) |

To build for production:

```bash
npm run build
npm run start
```

---

## Testing

### Smart contract tests (Foundry)

```bash
# Run all contract tests
forge test

# Run with verbose output and gas report
forge test -vvv --gas-report

# Run a specific test file
forge test --match-path test/DeadMansAgentRegistry.t.sol -vvv
```

### Linting

```bash
# Frontend lint
npm run lint
```

### Triggering the agent manually

With the dev server running, call the agent endpoint directly:

```bash
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -H "x-successor-agent-secret: change-me-for-cron" \
  -d '{}'
```

The agent will scan all plans, identify any that are overdue, and (in mock mode) log the actions it would take.

### Checking agent status

```bash
curl http://localhost:3000/api/agent/status
```

### Health check

```bash
curl http://localhost:3000/api/health
```

---

## Usage Flow

Below is the end-to-end journey from account creation to fund withdrawal.

```
1. SIGN UP
   └─ Owner visits /signup, enters email + password
   └─ Zustand persists auth state to localStorage

2. CONNECT WALLET
   └─ Owner clicks "Connect Wallet" → MetaMask prompts
   └─ Wallet address is linked to the auth session

3. CREATE ESTATE PLAN
   └─ Owner calls POST /api/plans with interval, grace period, beneficiaries, instructions
   └─ Owner calls registerPlan() on DeadMansAgentRegistry (on-chain tx)
   └─ Plan ID (bytes32 hash) is stored in both local state and on-chain

4. SEND HEARTBEAT  ← must repeat before interval expires
   └─ Owner clicks "Send Heartbeat" on /dashboard
   └─ Frontend calls recordHeartbeat(planId) on-chain (costs ~0.0001 ZG gas)
   └─ lastCheckInAt is updated on-chain
   └─ POST /api/plans/:id/heartbeat records the event off-chain

5. MISSED HEARTBEAT  ← owner stops responding
   └─ Cron job calls POST /api/agent/run (with SUCCESSOR_AGENT_SECRET)
   └─ Agent calls isExecutionEligible(planId) on-chain → returns true
   └─ Agent sends email to each beneficiary with a unique HMAC-signed link:
        https://your-app.com/confirm-kin/:ref

6. KIN CONFIRMATION
   └─ Beneficiary clicks the email link → /confirm-kin/:ref
   └─ Page calls GET /api/kin/confirm?ref=:ref to display plan details
   └─ Beneficiary clicks "Confirm" → POST /api/kin/confirm
   └─ confirmationRef is marked as verified in local state

7. INSTRUCTION EXECUTION
   └─ Agent processes the instruction queue in order:
        a. transfer_usdc  → sends USDC to beneficiary wallet
        b. notify         → delivers notification via webhook or mock
        c. custom_action  → POSTs payload to SUCCESSOR_ACTION_WEBHOOK_URL
   └─ Each action is attested on-chain via attest(payloadHash, action, planId, subjectId)
   └─ ActionAttested event is emitted and visible on the block explorer

8. AUDIT
   └─ Anyone can verify the attestation on-chain at /attestations
   └─ attestations[attestationId] returns agent, payloadHash, action, timestamp
```

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`.
2. Make your changes and ensure `npm run lint` and `forge test` pass.
3. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/).
4. Open a pull request against `main` with a description of what changed and why.

For significant changes, open an issue first to discuss the approach.

---

## Resources

- [0G Chain documentation](https://docs.0g.ai/)
- [0G Galileo block explorer](https://chainscan-galileo.0g.ai)
- [0G testnet faucet](https://faucet.0g.ai/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Wagmi v2 documentation](https://wagmi.sh/)
- [Viem documentation](https://viem.sh/)
- [Kite AI / OpenClaw](https://gokite.ai/)
- [WalletConnect Cloud](https://cloud.walletconnect.com/) (for `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`)

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

*Built for the 0G Chain ecosystem. Successor is experimental software — do not use with real assets without a thorough independent security audit.*
