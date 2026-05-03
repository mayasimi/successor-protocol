# Successor Protocol Backend

This backend implements the "Dead Man's Agent" flow as Next.js route handlers plus server-only services.

## What It Does

- Creates estate plans with owner wallet, next-of-kin, heartbeat policy, spending limits, farewell text, and queued instructions.
- Records on-chain heartbeat check-ins and computes warning/triggered state from interval plus grace period.
- Opens a Kite Agent Passport-style delegation session with budget and per-transfer limits.
- Runs an autonomous agent that executes queued instructions when the heartbeat expires.
- Enforces USDC spending policy before transfers.
- Writes a timestamped attestation for every meaningful action with SHA-256 proof and optional HMAC signature.
- Stores local demo state in `.successor-data/state.json`.

## Key Routes

- `GET /api/health`
- `GET /api/plans`
- `POST /api/plans`
- `GET /api/plans/:planId`
- `PATCH /api/plans/:planId`
- `GET /api/plans/:planId/heartbeat`
- `POST /api/plans/:planId/heartbeat`
- `GET /api/plans/:planId/instructions`
- `POST /api/plans/:planId/instructions`
- `GET /api/plans/:planId/beneficiaries`
- `POST /api/plans/:planId/beneficiaries`
- `GET /api/kin/confirm?ref=...`
- `POST /api/kin/confirm`
- `GET /api/attestations?planId=...`
- `GET /api/agent/status`
- `POST /api/agent/run`
- `POST /api/kite/session`

## Demo Plan Payload

```json
{
  "ownerName": "Alex Morgan",
  "ownerEmail": "alex@example.com",
  "ownerWallet": "0x1111111111111111111111111111111111111111",
  "heartbeat": {
    "intervalDays": 7,
    "gracePeriodDays": 3
  },
  "spendingPolicy": {
    "totalBudgetUsdc": 5000,
    "perTransferLimitUsdc": 2500,
    "sessionDurationHours": 720
  },
  "beneficiaries": [
    {
      "name": "Jamie Rivera",
      "email": "jamie@example.com",
      "walletAddress": "0x2222222222222222222222222222222222222222",
      "allocationPercent": 100
    }
  ],
  "instructions": [
    {
      "type": "transfer_usdc",
      "title": "Send emergency USDC",
      "amountUsdc": 2500,
      "recipientWallet": "0x2222222222222222222222222222222222222222",
      "recipientName": "Jamie Rivera"
    },
    {
      "type": "notify_contact",
      "title": "Notify next of kin",
      "contactName": "Jamie Rivera",
      "contactEmail": "jamie@example.com",
      "subject": "Alex's successor instructions",
      "message": "The successor agent has started executing Alex's instructions."
    },
    {
      "type": "publish_message",
      "title": "Publish farewell",
      "channel": "public",
      "message": "Thank you for carrying my story forward."
    }
  ]
}
```

## Kite Wiring

By default `KITE_PROVIDER_MODE=mock`, so demos work without keys. To go live, deploy `contracts/DeadMansAgentRegistry.sol` on Kite, then set:

- `KITE_PROVIDER_MODE=live`
- `KITE_AGENT_PRIVATE_KEY`
- `KITE_ATTESTATION_CONTRACT_ADDRESS`
- `KITE_USDC_TOKEN_ADDRESS`

Kite network defaults are testnet chain ID `2368` and RPC `https://rpc-testnet.gokite.ai/`.
