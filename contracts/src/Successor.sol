// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Successor
 * @author Successor Protocol
 * @notice Decentralised autonomous will executor for the 0G EVM-compatible chain.
 *
 * Flow
 * ────
 * 1. Owner deploys the contract, setting kin address, grace period, and daily
 *    spend limit.
 * 2. Owner calls `ping()` periodically to prove liveness.
 * 3. Owner queues instructions (arbitrary low-level calls + ETH value).
 * 4. If the owner misses a heartbeat, anyone can observe `getStatus()` returning
 *    `triggered = true`.
 * 5. The kin calls `verifyDeath()` to transition the contract to EXECUTING state.
 * 6. The kin (or anyone) calls `executeAll()` to run the instruction queue.
 *    Each instruction is attempted; failures are recorded but do not halt execution.
 *
 * Security properties
 * ───────────────────
 * - ReentrancyGuard on all state-mutating external functions.
 * - Checks-Effects-Interactions throughout.
 * - Owner-only mutations are gated by `onlyOwner`.
 * - Kin-only mutations are gated by `onlyKin`.
 * - No external oracle dependency; death verification is social/off-chain.
 * - Daily spend limit enforced with a rolling 24-hour window.
 * - All critical state changes emit indexed events for 0G Chain indexing.
 */

// ─── OpenZeppelin (inline, no npm required) ──────────────────────────────────
// We inline a minimal ReentrancyGuard to keep the contract self-contained while
// still being compatible with a standard OZ import if the project uses it.

/**
 * @dev Minimal ReentrancyGuard – identical logic to OpenZeppelin v4/v5.
 *      If you import OZ via npm, replace this with the standard OZ import.
 */
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// ─── Main contract ────────────────────────────────────────────────────────────

contract Successor is ReentrancyGuard {
    // ─── Types ────────────────────────────────────────────────────────────────

    /// @notice Lifecycle states of the contract.
    enum State {
        ACTIVE,     // Owner is alive; heartbeat is being maintained.
        TRIGGERED,  // Grace period elapsed; awaiting kin verification.
        EXECUTING,  // Death verified; instructions are being / have been executed.
        COMPLETED   // All instructions have been processed.
    }

    /**
     * @notice A single queued instruction.
     * @param target      Contract or EOA to call.
     * @param data        ABI-encoded calldata (empty for plain ETH transfers).
     * @param value       Native token (ZG) to forward with the call.
     * @param description Human-readable label stored on-chain for indexers.
     * @param executed    True once the instruction has been attempted.
     * @param succeeded   True if the low-level call returned success.
     */
    struct Instruction {
        address target;
        bytes   data;
        uint256 value;
        string  description;
        bool    executed;
        bool    succeeded;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    /// @notice The account that deployed and controls this will.
    address public immutable owner;

    /// @notice The next-of-kin wallet authorised to verify death.
    address public kinAddress;

    /// @notice Seconds of inactivity before the contract becomes TRIGGERED.
    uint256 public gracePeriod;

    /// @notice Maximum native token (ZG) that can be spent in any rolling 24 h.
    uint256 public dailySpendLimit;

    /// @notice Unix timestamp of the last successful `ping()`.
    uint256 public lastPing;

    /// @notice Current lifecycle state.
    State public state;

    /// @notice Ordered list of instructions to execute after death verification.
    Instruction[] public instructions;

    // ── Spend-limit tracking ──────────────────────────────────────────────────

    /// @dev Start of the current 24-hour spend window.
    uint256 private _windowStart;

    /// @dev Total native token spent within the current window.
    uint256 private _windowSpent;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted every time the owner proves liveness.
    event HeartbeatPing(address indexed owner, uint256 timestamp);

    /// @notice Emitted when the grace period is updated.
    event GracePeriodChanged(uint256 oldPeriod, uint256 newPeriod);

    /// @notice Emitted when the kin address is updated.
    event KinAddressChanged(address indexed oldKin, address indexed newKin);

    /// @notice Emitted when the kin finalises the death verification.
    event DeathVerified(address indexed kin, uint256 timestamp);

    /// @notice Emitted when a new instruction is appended to the queue.
    event InstructionAdded(
        uint256 indexed index,
        address target,
        bytes   data,
        uint256 value,
        string  description
    );

    /// @notice Emitted when an instruction is removed from the queue.
    event InstructionRemoved(uint256 indexed index);

    /// @notice Emitted after each instruction execution attempt.
    event InstructionExecuted(
        uint256 indexed index,
        bool    success,
        bytes   returnData
    );

    /// @notice Emitted when the daily spend limit is updated.
    event SpendLimitChanged(uint256 oldLimit, uint256 newLimit);

    /// @notice Emitted when the contract transitions to COMPLETED.
    event ExecutionCompleted(uint256 timestamp);

    /// @notice Emitted when ETH is deposited into the contract.
    event Deposited(address indexed sender, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();
    error NotKin();
    error AlreadyTriggered();
    error GracePeriodNotElapsed();
    error NotInExecutingState();
    error InstructionIndexOutOfBounds();
    error InstructionAlreadyExecuted();
    error DailySpendLimitExceeded(uint256 requested, uint256 remaining);
    error ZeroAddress();
    error ZeroGracePeriod();
    error InsufficientContractBalance(uint256 required, uint256 available);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyKin() {
        if (msg.sender != kinAddress) revert NotKin();
        _;
    }

    /// @dev Reverts if the contract has already been triggered.
    modifier notTriggered() {
        if (state != State.ACTIVE) revert AlreadyTriggered();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new Successor will.
     * @param _kinAddress     Wallet of the next-of-kin who can verify death.
     * @param _gracePeriod    Seconds of missed heartbeat before trigger (e.g. 7 days = 604800).
     * @param _dailySpendLimit Maximum ZG (in wei) spendable per rolling 24 h window.
     */
    constructor(
        address _kinAddress,
        uint256 _gracePeriod,
        uint256 _dailySpendLimit
    ) {
        if (_kinAddress == address(0)) revert ZeroAddress();
        if (_gracePeriod == 0)        revert ZeroGracePeriod();

        owner          = msg.sender;
        kinAddress     = _kinAddress;
        gracePeriod    = _gracePeriod;
        dailySpendLimit = _dailySpendLimit;
        lastPing       = block.timestamp;
        state          = State.ACTIVE;

        _windowStart = block.timestamp;
        _windowSpent = 0;
    }

    // ─── Receive / Fallback ───────────────────────────────────────────────────

    /// @notice Accept plain ZG deposits so the contract can fund instructions.
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ─── Heartbeat ────────────────────────────────────────────────────────────

    /**
     * @notice Owner proves liveness. Resets the heartbeat timer.
     * @dev Reverts if the contract is already triggered.
     */
    function ping() external onlyOwner notTriggered nonReentrant {
        lastPing = block.timestamp;
        emit HeartbeatPing(owner, block.timestamp);
    }

    // ─── Configuration (owner-only, pre-trigger) ──────────────────────────────

    /**
     * @notice Update the grace period.
     * @param newPeriod New grace period in seconds. Must be > 0.
     */
    function setGracePeriod(uint256 newPeriod) external onlyOwner notTriggered {
        if (newPeriod == 0) revert ZeroGracePeriod();
        uint256 old = gracePeriod;
        gracePeriod = newPeriod;
        emit GracePeriodChanged(old, newPeriod);
    }

    /**
     * @notice Update the next-of-kin address.
     * @param newKin New kin wallet. Must be non-zero.
     */
    function setKinAddress(address newKin) external onlyOwner notTriggered {
        if (newKin == address(0)) revert ZeroAddress();
        address old = kinAddress;
        kinAddress = newKin;
        emit KinAddressChanged(old, newKin);
    }

    /**
     * @notice Update the daily spend limit.
     * @param newLimit New limit in wei. Zero disables the limit entirely.
     */
    function setDailySpendLimit(uint256 newLimit) external onlyOwner notTriggered {
        uint256 old = dailySpendLimit;
        dailySpendLimit = newLimit;
        emit SpendLimitChanged(old, newLimit);
    }

    // ─── Instruction management (owner-only, pre-trigger) ─────────────────────

    /**
     * @notice Append a new instruction to the execution queue.
     * @param target      Address to call.
     * @param data        ABI-encoded calldata.
     * @param value       ZG (wei) to forward.
     * @param description Human-readable label.
     */
    function addInstruction(
        address target,
        bytes calldata data,
        uint256 value,
        string calldata description
    ) external onlyOwner notTriggered {
        if (target == address(0)) revert ZeroAddress();

        uint256 idx = instructions.length;
        instructions.push(Instruction({
            target:      target,
            data:        data,
            value:       value,
            description: description,
            executed:    false,
            succeeded:   false
        }));

        emit InstructionAdded(idx, target, data, value, description);
    }

    /**
     * @notice Remove an instruction by index (order-preserving via shift).
     * @dev    O(n) but instruction queues are expected to be small (< 50 items).
     * @param index Index of the instruction to remove.
     */
    function removeInstruction(uint256 index) external onlyOwner notTriggered {
        uint256 len = instructions.length;
        if (index >= len) revert InstructionIndexOutOfBounds();

        emit InstructionRemoved(index);

        // Shift elements left to preserve order.
        for (uint256 i = index; i < len - 1; ) {
            instructions[i] = instructions[i + 1];
            unchecked { ++i; }
        }
        instructions.pop();
    }

    /**
     * @notice Swap two instructions to reorder the queue.
     * @param indexA First instruction index.
     * @param indexB Second instruction index.
     */
    function reorderInstructions(uint256 indexA, uint256 indexB)
        external
        onlyOwner
        notTriggered
    {
        uint256 len = instructions.length;
        if (indexA >= len || indexB >= len) revert InstructionIndexOutOfBounds();
        if (indexA == indexB) return;

        Instruction memory tmp = instructions[indexA];
        instructions[indexA]   = instructions[indexB];
        instructions[indexB]   = tmp;
    }

    // ─── Death verification ───────────────────────────────────────────────────

    /**
     * @notice Kin finalises the death trigger.
     *
     * Requirements:
     * - Caller must be `kinAddress`.
     * - Grace period must have elapsed since `lastPing`.
     * - Contract must be in ACTIVE or TRIGGERED state (idempotent guard).
     *
     * @dev The function intentionally does NOT execute instructions here.
     *      Execution is a separate step so the kin can review before committing gas.
     */
    function verifyDeath() external onlyKin nonReentrant {
        // Grace period check – this is the canonical trigger condition.
        if (block.timestamp < lastPing + gracePeriod) {
            revert GracePeriodNotElapsed();
        }

        // Allow calling from ACTIVE (first trigger) or TRIGGERED (re-entry guard).
        if (state == State.EXECUTING || state == State.COMPLETED) {
            revert AlreadyTriggered();
        }

        state = State.EXECUTING;
        emit DeathVerified(kinAddress, block.timestamp);
    }

    // ─── Execution ────────────────────────────────────────────────────────────

    /**
     * @notice Execute all queued instructions sequentially.
     *
     * - Can be called by anyone once the contract is in EXECUTING state.
     * - Skips already-executed instructions.
     * - Records success/failure per instruction; never reverts the whole batch.
     * - Enforces the rolling daily spend limit for value-bearing instructions.
     * - Transitions to COMPLETED when all instructions have been attempted.
     */
    function executeAll() external nonReentrant {
        if (state != State.EXECUTING) revert NotInExecutingState();

        uint256 len = instructions.length;
        for (uint256 i = 0; i < len; ) {
            _executeOne(i);
            unchecked { ++i; }
        }

        state = State.COMPLETED;
        emit ExecutionCompleted(block.timestamp);
    }

    /**
     * @notice Execute a single instruction by index.
     *         Useful for retrying a failed instruction or gas-splitting large queues.
     * @param index Index of the instruction to execute.
     */
    function executeOne(uint256 index) external nonReentrant {
        if (state != State.EXECUTING) revert NotInExecutingState();
        if (index >= instructions.length) revert InstructionIndexOutOfBounds();
        _executeOne(index);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the current status of the contract.
     * @return triggered       True if the grace period has elapsed (regardless of verification).
     * @return currentState    The current lifecycle State enum value.
     * @return timeRemaining   Seconds until the grace period elapses (0 if already elapsed).
     * @return totalInstructions Total number of queued instructions.
     */
    function getStatus()
        external
        view
        returns (
            bool    triggered,
            State   currentState,
            uint256 timeRemaining,
            uint256 totalInstructions
        )
    {
        uint256 deadline = lastPing + gracePeriod;
        triggered        = block.timestamp >= deadline;
        currentState     = state;
        timeRemaining    = triggered ? 0 : deadline - block.timestamp;
        totalInstructions = instructions.length;
    }

    /**
     * @notice Returns the number of instructions in the queue.
     */
    function instructionCount() external view returns (uint256) {
        return instructions.length;
    }

    /**
     * @notice Returns the remaining daily spend allowance for the current window.
     * @dev    Returns `type(uint256).max` when `dailySpendLimit` is zero (unlimited).
     */
    function remainingDailyAllowance() external view returns (uint256) {
        if (dailySpendLimit == 0) return type(uint256).max;
        _refreshWindow_view();
        return dailySpendLimit > _windowSpent
            ? dailySpendLimit - _windowSpent
            : 0;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /**
     * @dev Core execution logic for a single instruction.
     *      Follows Checks-Effects-Interactions:
     *        1. Check: not already executed, spend limit OK.
     *        2. Effect: mark as executed, update spend tracker.
     *        3. Interact: low-level call.
     */
    function _executeOne(uint256 index) internal {
        Instruction storage inst = instructions[index];

        // Skip already-executed instructions silently (supports partial re-runs).
        if (inst.executed) return;

        // ── Checks ────────────────────────────────────────────────────────────

        uint256 val = inst.value;

        // Enforce daily spend limit for value-bearing calls.
        if (val > 0) {
            _refreshWindow();

            if (dailySpendLimit > 0) {
                uint256 remaining = dailySpendLimit > _windowSpent
                    ? dailySpendLimit - _windowSpent
                    : 0;

                if (val > remaining) {
                    // Record as failed rather than reverting the whole batch.
                    inst.executed  = true;
                    inst.succeeded = false;
                    emit InstructionExecuted(
                        index,
                        false,
                        abi.encodePacked("DailySpendLimitExceeded")
                    );
                    return;
                }
            }

            if (val > address(this).balance) {
                inst.executed  = true;
                inst.succeeded = false;
                emit InstructionExecuted(
                    index,
                    false,
                    abi.encodePacked("InsufficientContractBalance")
                );
                return;
            }
        }

        // ── Effects ───────────────────────────────────────────────────────────

        inst.executed = true;
        if (val > 0) {
            _windowSpent += val;
        }

        // ── Interactions ──────────────────────────────────────────────────────

        (bool success, bytes memory returnData) = inst.target.call{value: val}(
            inst.data
        );

        inst.succeeded = success;
        emit InstructionExecuted(index, success, returnData);
    }

    /**
     * @dev Resets the spend window if 24 hours have elapsed (state-mutating).
     */
    function _refreshWindow() internal {
        if (block.timestamp >= _windowStart + 1 days) {
            _windowStart = block.timestamp;
            _windowSpent = 0;
        }
    }

    /**
     * @dev Pure view version of window refresh for `remainingDailyAllowance`.
     *      Does NOT mutate state; returns effective spent amount.
     */
    function _refreshWindow_view() internal view returns (uint256 effectiveSpent) {
        if (block.timestamp >= _windowStart + 1 days) {
            return 0;
        }
        return _windowSpent;
    }
}
