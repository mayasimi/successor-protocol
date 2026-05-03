// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Kite-compatible registry for heartbeat and action attestations.
/// @dev The backend can run in mock mode, then point KITE_ATTESTATION_CONTRACT_ADDRESS here after deployment.
contract DeadMansAgentRegistry {
    struct HeartbeatPlan {
        address owner;
        uint64 intervalDays;
        uint64 gracePeriodDays;
        uint64 lastCheckInAt;
        bool exists;
    }

    struct Attestation {
        address agent;
        bytes32 payloadHash;
        string action;
        string planId;
        string subjectId;
        uint256 timestamp;
    }

    mapping(bytes32 => HeartbeatPlan) public heartbeatPlans;
    mapping(bytes32 => Attestation) public attestations;

    event PlanRegistered(
        bytes32 indexed planId,
        address indexed owner,
        uint64 intervalDays,
        uint64 gracePeriodDays,
        uint256 timestamp
    );
    event HeartbeatRecorded(
        bytes32 indexed planId,
        address indexed owner,
        uint256 timestamp
    );
    event ActionAttested(
        bytes32 indexed attestationId,
        bytes32 indexed payloadHash,
        address indexed agent,
        string action,
        string planId,
        string subjectId,
        uint256 timestamp
    );

    error PlanAlreadyRegistered();
    error PlanNotFound();
    error NotPlanOwner();
    error DuplicateAttestation();

    function registerPlan(
        bytes32 planId,
        uint64 intervalDays,
        uint64 gracePeriodDays
    ) external {
        if (heartbeatPlans[planId].exists) revert PlanAlreadyRegistered();

        heartbeatPlans[planId] = HeartbeatPlan({
            owner: msg.sender,
            intervalDays: intervalDays,
            gracePeriodDays: gracePeriodDays,
            lastCheckInAt: uint64(block.timestamp),
            exists: true
        });

        emit PlanRegistered(
            planId,
            msg.sender,
            intervalDays,
            gracePeriodDays,
            block.timestamp
        );
    }

    function recordHeartbeat(bytes32 planId) external {
        HeartbeatPlan storage plan = heartbeatPlans[planId];
        if (!plan.exists) revert PlanNotFound();
        if (plan.owner != msg.sender) revert NotPlanOwner();

        plan.lastCheckInAt = uint64(block.timestamp);
        emit HeartbeatRecorded(planId, msg.sender, block.timestamp);
    }

    function executionEligibleAt(bytes32 planId) public view returns (uint256) {
        HeartbeatPlan memory plan = heartbeatPlans[planId];
        if (!plan.exists) revert PlanNotFound();

        return
            uint256(plan.lastCheckInAt) +
            ((uint256(plan.intervalDays) + uint256(plan.gracePeriodDays)) * 1 days);
    }

    function isExecutionEligible(bytes32 planId) external view returns (bool) {
        return block.timestamp >= executionEligibleAt(planId);
    }

    function attest(
        bytes32 payloadHash,
        string calldata action,
        string calldata planId,
        string calldata subjectId
    ) external returns (bytes32 attestationId) {
        attestationId = keccak256(
            abi.encode(msg.sender, payloadHash, action, planId, subjectId, block.timestamp)
        );

        if (attestations[attestationId].timestamp != 0) revert DuplicateAttestation();

        attestations[attestationId] = Attestation({
            agent: msg.sender,
            payloadHash: payloadHash,
            action: action,
            planId: planId,
            subjectId: subjectId,
            timestamp: block.timestamp
        });

        emit ActionAttested(
            attestationId,
            payloadHash,
            msg.sender,
            action,
            planId,
            subjectId,
            block.timestamp
        );
    }
}
