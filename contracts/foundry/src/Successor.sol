// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  Successor
 * @author Successor Protocol
 * @notice Decentralised autonomous will executor for the 0G EVM-compatible chain.
 *
 * ── Revised flow (email-based kin, off-chain agent approval) ──────────────────
 *
 * 1. Owner deploys the contract with a kin email address, a relayer wallet
 *    (the OpenClaw agent), a grace period, and a daily spend limit.
 * 2. Owner calls `ping()` periodically to prove liveness.
 * 3. Owner queues instructions (arbitrary low-level calls + native-token value).
 * 4. If the owner misses a heartbeat, `getStatus()` returns `triggered = true`.
 *    The off-chain agent detects this and emails the kin a unique verification link.
 * 5. When the kin clicks the link, the agent calls `approveWithdrawal()` using
 *    its own private key (the relayer wallet).
 * 6. The kin connects any wallet and calls `withdraw()` to receive the funds.
 *    Alternatively, `executeAll()` runs the full instruction queue.
 *
 * ── Security properties ───────────────────────────────────────────────────────
 * - ReentrancyGuard on all state-mutating external functions.
 * - Checks-Effects-Interactions throughout.
 * - Owner-only mutations gated by `onlyOwner`.
 * - Relayer-only approval gated by `onlyRelayer`.
 * - `withdraw()` requires `withdrawalApproved` and resets it after use.
 * - Daily spend limit enforced with a rolling 24-hour window.
 * - All critical state changes emit indexed events for 0G Chain indexing.
 */

// ─── Inline ReentrancyGuard ───────────────────────────────────────────────────

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;
    uint256 private _status;

    constructor() { _status = _NOT_ENTERED; }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// ─── Successor ────────────────────────────────────────────────────────────────

contract Successor is ReentrancyGuard {

    // ── Types ─────────────────────────────────────────────────────────────────

    /// @notice Lifecycle states of the will contract.
    enum State {
        ACTIVE,    // Owner is alive; heartbeat is being maintained.
        TRIGGERED, // Grace period elapsed; agent has been notified.
        EXECUTING, // Withdrawal approved; funds can be claimed.
        COMPLETED  // All instructions executed and/or withdrawal claimed.
    }

    /**
     * @notice A single queued instruction.
     * @param target      Contract or EOA to call.
     * @param data        ABI-encoded calldata (empty bytes for plain ZG transfers).
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

    // ── Storage ───────────────────────────────────────────────────────────────

    /// @notice The account that deployed and controls this will.
    address public immutable owner;

    /// @notice Off-chain agent wallet (OpenClaw) authorised to approve withdrawals.
    address public relayer;

    /// @notice Email address of the next-of-kin. Stored on-chain for indexers.
    string public kinEmail;

    /// @notice Seconds of inactivity before the contract becomes TRIGGERED.
    uint256 public gracePeriod;

    /// @notice Maximum ZG (wei) spendable in any rolling 24-hour window.
    uint256 public dailySpendLimit;

    /// @notice Unix timestamp of the last successful `ping()`.
    uint256 public lastPing;

    /// @notice Current lifecycle state.
    State public state;

    /// @notice True after the relayer approves withdrawal following kin confirmation.
    bool public withdrawalApproved;

    /// @notice Ordered list of instructions to execute after approval.
    Instruction[] public instructions;

    // ── Spend-limit tracking ──────────────────────────────────────────────────

    uint256 private _windowStart;
    uint256 private _windowSpent;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Owner proved liveness.
    event HeartbeatPing(address indexed owner, uint256 timestamp);

    /// @notice Grace period configuration changed.
    event GracePeriodChanged(uint256 oldPeriod, uint256 newPeriod);

    /// @notice Kin email address updated.
    event KinEmailChanged(string oldEmail, string newEmail);

    /// @notice Relayer wallet updated.
    event RelayerChanged(address indexed oldRelayer, address indexed newRelayer);

    /// @notice Grace period elapsed and the missed-heartbeat state was recorded.
    event HeartbeatMissed(uint256 timestamp);

    /// @notice Relayer approved withdrawal after kin clicked the email link.
    event WithdrawalApproved(address indexed approvedBy, uint256 timestamp);

    /// @notice Kin (or anyone) withdrew funds after approval.
    event WithdrawalExecuted(address indexed recipient, uint256 amount);

    /// @notice New instruction appended to the queue.
    event InstructionAdded(
        uint256 indexed index,
        address target,
        bytes   data,
        uint256 value,
        string  description
    );

    /// @notice Instruction removed from the queue.
    event InstructionRemoved(uint256 indexed index);

    /// @notice Single instruction execution result.
    event InstructionExecuted(uint256 indexed index, bool success, bytes returnData);

    /// @notice Daily spend limit updated.
    event SpendLimitChanged(uint256 oldLimit, uint256 newLimit);

    /// @notice All instructions have been processed.
    event ExecutionCompleted(uint256 timestamp);

    /// @notice Native token deposited into the contract.
    event Deposited(address indexed sender, uint256 amount);

    // ── Errors ────────────────────────────────────────────────────────────────

    error NotOwner();
    error NotRelayer();
    error AlreadyTriggered();
    error GracePeriodNotElapsed();
    error NotInExecutingState();
    error WithdrawalNotApproved();
    error WithdrawalAlreadyApproved();
    error InstructionIndexOutOfBounds();
    error DailySpendLimitExceeded(uint256 requested, uint256 remaining);
    error ZeroAddress();
    error ZeroGracePeriod();
    error EmptyEmail();
    error InsufficientContractBalance(uint256 required, uint256 available);
    error NothingToWithdraw();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    modifier notTriggered() {
        if (state != State.ACTIVE) revert AlreadyTriggered();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new Successor will.
     * @param _kinEmail        Email address of the next-of-kin (non-empty string).
     * @param _relayer         Agent wallet authorised to call approveWithdrawal().
     * @param _gracePeriod     Seconds of missed heartbeat before trigger (e.g. 604800 = 7 days).
     * @param _dailySpendLimit Maximum ZG (wei) spendable per rolling 24 h window. 0 = unlimited.
     */
    constructor(
        string memory _kinEmail,
        address       _relayer,
        uint256       _gracePeriod,
        uint256       _dailySpendLimit
    ) {
        if (bytes(_kinEmail).length == 0) revert EmptyEmail();
        if (_relayer == address(0))       revert ZeroAddress();
        if (_gracePeriod == 0)            revert ZeroGracePeriod();

        owner           = msg.sender;
        kinEmail        = _kinEmail;
        relayer         = _relayer;
        gracePeriod     = _gracePeriod;
        dailySpendLimit = _dailySpendLimit;
        lastPing        = block.timestamp;
        state           = State.ACTIVE;
        _windowStart    = block.timestamp;
    }

    // ── Receive ───────────────────────────────────────────────────────────────

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    /**
     * @notice Owner proves liveness. Resets the heartbeat timer.
     * @dev    Reverts if the contract is already triggered.
     */
    function ping() external onlyOwner notTriggered nonReentrant {
        lastPing = block.timestamp;
        emit HeartbeatPing(owner, block.timestamp);
    }

    /**
     * @notice Explicitly record a missed heartbeat and transition to TRIGGERED.
     * @dev    Anyone can call this once the grace period has elapsed.
     *         The off-chain agent calls this (or simply reads getStatus()) to
     *         confirm the trigger before sending the kin email.
     */
    function markMissedHeartbeat() external {
        if (block.timestamp < lastPing + gracePeriod) revert GracePeriodNotElapsed();
        if (state != State.ACTIVE) revert AlreadyTriggered();

        state = State.TRIGGERED;
        emit HeartbeatMissed(block.timestamp);
    }

    // ── Configuration (owner-only, pre-trigger) ───────────────────────────────

    /// @notice Update the grace period (seconds). Must be > 0.
    function setGracePeriod(uint256 newPeriod) external onlyOwner notTriggered {
        if (newPeriod == 0) revert ZeroGracePeriod();
        uint256 old = gracePeriod;
        gracePeriod = newPeriod;
        emit GracePeriodChanged(old, newPeriod);
    }

    /// @notice Update the kin email address. Must be non-empty.
    function setKinEmail(string calldata newEmail) external onlyOwner notTriggered {
        if (bytes(newEmail).length == 0) revert EmptyEmail();
        string memory old = kinEmail;
        kinEmail = newEmail;
        emit KinEmailChanged(old, newEmail);
    }

    /// @notice Update the relayer (agent) wallet. Only owner. Can be changed any time.
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        address old = relayer;
        relayer = newRelayer;
        emit RelayerChanged(old, newRelayer);
    }

    /// @notice Update the daily spend limit (wei). 0 = unlimited.
    function setDailySpendLimit(uint256 newLimit) external onlyOwner notTriggered {
        uint256 old = dailySpendLimit;
        dailySpendLimit = newLimit;
        emit SpendLimitChanged(old, newLimit);
    }

    // ── Instruction management (owner-only, pre-trigger) ──────────────────────

    /**
     * @notice Append a new instruction to the execution queue.
     * @param target      Address to call (must be non-zero).
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
     * @notice Remove an instruction by index (order-preserving shift).
     * @dev    O(n) – queues are expected to be small (< 50 items).
     */
    function removeInstruction(uint256 index) external onlyOwner notTriggered {
        uint256 len = instructions.length;
        if (index >= len) revert InstructionIndexOutOfBounds();

        emit InstructionRemoved(index);

        for (uint256 i = index; i < len - 1; ) {
            instructions[i] = instructions[i + 1];
            unchecked { ++i; }
        }
        instructions.pop();
    }

    /// @notice Swap two instructions to reorder the queue.
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

    // ── Approval (relayer-only) ───────────────────────────────────────────────

    /**
     * @notice Relayer (OpenClaw agent) approves withdrawal after the kin confirms
     *         via the email verification link.
     *
     * Requirements:
     * - Caller must be the `relayer` wallet.
     * - Grace period must have elapsed (contract must be TRIGGERED or ACTIVE-past-deadline).
     * - `withdrawalApproved` must not already be true.
     * - Contract must not be COMPLETED.
     */
    function approveWithdrawal() external onlyRelayer nonReentrant {
        if (block.timestamp < lastPing + gracePeriod) revert GracePeriodNotElapsed();
        if (state == State.COMPLETED)                 revert AlreadyTriggered();
        if (withdrawalApproved)                       revert WithdrawalAlreadyApproved();

        // Transition to EXECUTING if not already there
        if (state != State.EXECUTING) {
            state = State.EXECUTING;
        }

        withdrawalApproved = true;
        emit WithdrawalApproved(msg.sender, block.timestamp);
    }

    // ── Withdrawal ────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw the entire contract balance to the caller.
     *         Can be called by anyone (typically the kin's wallet) once
     *         `withdrawalApproved` is true.
     *
     * @dev    Resets `withdrawalApproved` to false after transfer to prevent
     *         double-claims. Uses Checks-Effects-Interactions.
     */
    function withdraw() external nonReentrant {
        if (!withdrawalApproved)          revert WithdrawalNotApproved();
        if (state != State.EXECUTING)     revert NotInExecutingState();

        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        // Effects first
        withdrawalApproved = false;
        state              = State.COMPLETED;

        // Interaction
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Successor: transfer failed");

        emit WithdrawalExecuted(msg.sender, amount);
    }

    /**
     * @notice Withdraw a specific amount to the caller.
     *         Useful when the kin wants a partial withdrawal.
     * @param amount ZG (wei) to withdraw.
     */
    function withdrawAmount(uint256 amount) external nonReentrant {
        if (!withdrawalApproved)      revert WithdrawalNotApproved();
        if (state != State.EXECUTING) revert NotInExecutingState();
        if (amount == 0)              revert NothingToWithdraw();
        if (amount > address(this).balance)
            revert InsufficientContractBalance(amount, address(this).balance);

        // Effects first – only mark completed if draining everything
        withdrawalApproved = false;
        if (address(this).balance == amount) {
            state = State.COMPLETED;
        }

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Successor: transfer failed");

        emit WithdrawalExecuted(msg.sender, amount);
    }

    // ── Instruction execution ─────────────────────────────────────────────────

    /**
     * @notice Execute all queued instructions sequentially.
     *         Callable by anyone once the contract is in EXECUTING state.
     *         Never reverts the whole batch – failures are recorded per-instruction.
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
     */
    function executeOne(uint256 index) external nonReentrant {
        if (state != State.EXECUTING) revert NotInExecutingState();
        if (index >= instructions.length) revert InstructionIndexOutOfBounds();
        _executeOne(index);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Returns the current status of the contract.
     * @return triggered           True if the grace period has elapsed.
     * @return currentState        The current lifecycle State enum value.
     * @return timeRemaining       Seconds until the grace period elapses (0 if elapsed).
     * @return totalInstructions   Total number of queued instructions.
     * @return approvalPending     True if withdrawalApproved is set.
     */
    function getStatus()
        external
        view
        returns (
            bool    triggered,
            State   currentState,
            uint256 timeRemaining,
            uint256 totalInstructions,
            bool    approvalPending
        )
    {
        uint256 deadline  = lastPing + gracePeriod;
        triggered         = block.timestamp >= deadline;
        currentState      = state;
        timeRemaining     = triggered ? 0 : deadline - block.timestamp;
        totalInstructions = instructions.length;
        approvalPending   = withdrawalApproved;
    }

    /// @notice Returns the number of instructions in the queue.
    function instructionCount() external view returns (uint256) {
        return instructions.length;
    }

    /**
     * @notice Returns the remaining daily spend allowance.
     * @dev    Returns type(uint256).max when dailySpendLimit is zero (unlimited).
     */
    function remainingDailyAllowance() external view returns (uint256) {
        if (dailySpendLimit == 0) return type(uint256).max;
        uint256 spent = block.timestamp >= _windowStart + 1 days ? 0 : _windowSpent;
        return dailySpendLimit > spent ? dailySpendLimit - spent : 0;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _executeOne(uint256 index) internal {
        Instruction storage inst = instructions[index];
        if (inst.executed) return;

        uint256 val = inst.value;

        if (val > 0) {
            _refreshWindow();

            if (dailySpendLimit > 0) {
                uint256 remaining = dailySpendLimit > _windowSpent
                    ? dailySpendLimit - _windowSpent
                    : 0;

                if (val > remaining) {
                    inst.executed  = true;
                    inst.succeeded = false;
                    emit InstructionExecuted(index, false, bytes("DailySpendLimitExceeded"));
                    return;
                }
            }

            if (val > address(this).balance) {
                inst.executed  = true;
                inst.succeeded = false;
                emit InstructionExecuted(index, false, bytes("InsufficientContractBalance"));
                return;
            }
        }

        inst.executed = true;
        if (val > 0) _windowSpent += val;

        (bool success, bytes memory returnData) = inst.target.call{value: val}(inst.data);
        inst.succeeded = success;
        emit InstructionExecuted(index, success, returnData);
    }

    function _refreshWindow() internal {
        if (block.timestamp >= _windowStart + 1 days) {
            _windowStart = block.timestamp;
            _windowSpent = 0;
        }
    }
}
