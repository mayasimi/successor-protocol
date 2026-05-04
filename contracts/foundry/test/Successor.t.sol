// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Run with:
//   forge test -vv
//   forge test --match-test <testName> -vvvv

import "forge-std/Test.sol";
import "../src/Successor.sol";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// @dev Rejects all ETH — used for failure-path tests.
contract RejectEther {
    receive() external payable { revert("rejected"); }
    fallback() external payable { revert("rejected"); }
}

/// @dev Accepts ETH and records calls.
contract AcceptEther {
    uint256 public received;
    bytes   public lastData;
    receive() external payable { received += msg.value; }
    fallback() external payable { received += msg.value; lastData = msg.data; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Base test setup
// ═══════════════════════════════════════════════════════════════════════════════

abstract contract SuccessorBase is Test {
    // ── Mirror events (Solidity 0.8.19 cannot reference events via ContractName.Event) ──
    event HeartbeatPing(address indexed owner, uint256 timestamp);
    event GracePeriodChanged(uint256 oldPeriod, uint256 newPeriod);
    event KinEmailChanged(string oldEmail, string newEmail);
    event RelayerChanged(address indexed oldRelayer, address indexed newRelayer);
    event HeartbeatMissed(uint256 timestamp);
    event WithdrawalApproved(address indexed approvedBy, uint256 timestamp);
    event WithdrawalExecuted(address indexed recipient, uint256 amount);
    event InstructionAdded(uint256 indexed index, address target, bytes data, uint256 value, string description);
    event InstructionRemoved(uint256 indexed index);
    event InstructionExecuted(uint256 indexed index, bool success, bytes returnData);
    event SpendLimitChanged(uint256 oldLimit, uint256 newLimit);
    event ExecutionCompleted(uint256 timestamp);
    event Deposited(address indexed sender, uint256 amount);
    // ── Actors ────────────────────────────────────────────────────────────────
    address internal owner   = makeAddr("owner");
    address internal relayer = makeAddr("relayer");   // OpenClaw agent wallet
    address internal kin     = makeAddr("kin");       // any wallet — no longer registered on-chain
    address internal stranger = makeAddr("stranger");

    // ── Contract ──────────────────────────────────────────────────────────────
    Successor internal s;

    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 internal constant SEVEN_DAYS  = 7 days;
    uint256 internal constant ONE_ETHER   = 1 ether;
    uint256 internal constant DAILY_LIMIT = 10 ether;
    string  internal constant KIN_EMAIL   = "jamie@example.com";

    function setUp() public virtual {
        vm.deal(owner,    100 ether);
        vm.deal(relayer,  10 ether);
        vm.deal(kin,      10 ether);
        vm.deal(stranger, 10 ether);

        vm.prank(owner);
        s = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, DAILY_LIMIT);
    }

    // ── Utility helpers ───────────────────────────────────────────────────────

    /// Warp past the grace period so the contract becomes triggerable.
    function _elapseGracePeriod() internal {
        vm.warp(s.lastPing() + s.gracePeriod() + 1);
    }

    /// Relayer approves withdrawal (simulates kin clicking email link).
    function _approveWithdrawal() internal {
        _elapseGracePeriod();
        vm.prank(relayer);
        s.approveWithdrawal();
    }

    /// Add a plain ETH-transfer instruction; returns its index.
    function _addTransfer(address target, uint256 value)
        internal
        returns (uint256 idx)
    {
        idx = s.instructionCount();
        vm.prank(owner);
        s.addInstruction(target, "", value, "transfer");
    }

    /// Fund the contract.
    function _fund(uint256 amount) internal {
        vm.deal(address(s), amount);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Constructor
// ═══════════════════════════════════════════════════════════════════════════════

contract ConstructorTest is SuccessorBase {
    function test_InitialState() public view {
        assertEq(s.owner(),           owner);
        assertEq(s.relayer(),         relayer);
        assertEq(s.kinEmail(),        KIN_EMAIL);
        assertEq(s.gracePeriod(),     SEVEN_DAYS);
        assertEq(s.dailySpendLimit(), DAILY_LIMIT);
        assertEq(uint256(s.state()),  uint256(Successor.State.ACTIVE));
        assertFalse(s.withdrawalApproved());
    }

    function test_LastPingIsDeployBlock() public view {
        assertEq(s.lastPing(), block.timestamp);
    }

    function test_RevertIf_EmptyEmail() public {
        vm.expectRevert(Successor.EmptyEmail.selector);
        new Successor("", relayer, SEVEN_DAYS, DAILY_LIMIT);
    }

    function test_RevertIf_RelayerIsZeroAddress() public {
        vm.expectRevert(Successor.ZeroAddress.selector);
        new Successor(KIN_EMAIL, address(0), SEVEN_DAYS, DAILY_LIMIT);
    }

    function test_RevertIf_GracePeriodIsZero() public {
        vm.expectRevert(Successor.ZeroGracePeriod.selector);
        new Successor(KIN_EMAIL, relayer, 0, DAILY_LIMIT);
    }

    function test_ZeroDailyLimit_IsAllowed() public {
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 0);
        assertEq(s2.dailySpendLimit(), 0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Receive / Deposit
// ═══════════════════════════════════════════════════════════════════════════════

contract DepositTest is SuccessorBase {
    function test_AcceptsEthAndEmitsDeposited() public {
        vm.expectEmit(true, false, false, true, address(s));
        emit Deposited(stranger, ONE_ETHER);

        vm.prank(stranger);
        (bool ok,) = address(s).call{value: ONE_ETHER}("");
        assertTrue(ok);
    }

    function test_BalanceIncreasesOnDeposit() public {
        vm.prank(stranger);
        (bool ok,) = address(s).call{value: ONE_ETHER}("");
        assertTrue(ok);
        assertEq(address(s).balance, ONE_ETHER);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Heartbeat – ping()
// ═══════════════════════════════════════════════════════════════════════════════

contract PingTest is SuccessorBase {
    function test_UpdatesLastPingAndEmitsEvent() public {
        vm.warp(block.timestamp + 1000);

        vm.expectEmit(true, false, false, true, address(s));
        emit HeartbeatPing(owner, block.timestamp);

        vm.prank(owner);
        s.ping();

        assertEq(s.lastPing(), block.timestamp);
    }

    function test_RevertIf_CallerIsNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.ping();
    }

    function test_RevertIf_AlreadyTriggered() public {
        // markMissedHeartbeat transitions to TRIGGERED, blocking ping
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.ping();
    }

    function test_Fuzz_PingResetsTimer(uint32 delta) public {
        vm.assume(delta > 0 && delta < 365 days);
        vm.warp(block.timestamp + delta);

        vm.prank(owner);
        s.ping();

        assertEq(s.lastPing(), block.timestamp);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Configuration
// ═══════════════════════════════════════════════════════════════════════════════

contract ConfigTest is SuccessorBase {
    // ── setGracePeriod ────────────────────────────────────────────────────────

    function test_SetGracePeriod_UpdatesAndEmits() public {
        uint256 newPeriod = 14 days;

        vm.expectEmit(false, false, false, true, address(s));
        emit GracePeriodChanged(SEVEN_DAYS, newPeriod);

        vm.prank(owner);
        s.setGracePeriod(newPeriod);

        assertEq(s.gracePeriod(), newPeriod);
    }

    function test_SetGracePeriod_RevertIf_Zero() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroGracePeriod.selector);
        s.setGracePeriod(0);
    }

    function test_SetGracePeriod_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.setGracePeriod(1 days);
    }

    function test_SetGracePeriod_RevertIf_Triggered() public {
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.setGracePeriod(1 days);
    }

    // ── setKinEmail ───────────────────────────────────────────────────────────

    function test_SetKinEmail_UpdatesAndEmits() public {
        string memory newEmail = "new@example.com";

        vm.expectEmit(false, false, false, true, address(s));
        emit KinEmailChanged(KIN_EMAIL, newEmail);

        vm.prank(owner);
        s.setKinEmail(newEmail);

        assertEq(s.kinEmail(), newEmail);
    }

    function test_SetKinEmail_RevertIf_Empty() public {
        vm.prank(owner);
        vm.expectRevert(Successor.EmptyEmail.selector);
        s.setKinEmail("");
    }

    function test_SetKinEmail_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.setKinEmail("x@x.com");
    }

    function test_SetKinEmail_RevertIf_Triggered() public {
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.setKinEmail("new@example.com");
    }

    // ── setRelayer ────────────────────────────────────────────────────────────

    function test_SetRelayer_UpdatesAndEmits() public {
        address newRelayer = makeAddr("newRelayer");

        vm.expectEmit(true, true, false, false, address(s));
        emit RelayerChanged(relayer, newRelayer);

        vm.prank(owner);
        s.setRelayer(newRelayer);

        assertEq(s.relayer(), newRelayer);
    }

    function test_SetRelayer_RevertIf_Zero() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroAddress.selector);
        s.setRelayer(address(0));
    }

    function test_SetRelayer_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.setRelayer(stranger);
    }

    function test_SetRelayer_AllowedAfterTrigger() public {
        // setRelayer has no notTriggered guard — can be changed any time
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        address newRelayer = makeAddr("newRelayer");
        vm.prank(owner);
        s.setRelayer(newRelayer); // must not revert
        assertEq(s.relayer(), newRelayer);
    }

    // ── setDailySpendLimit ────────────────────────────────────────────────────

    function test_SetDailySpendLimit_UpdatesAndEmits() public {
        uint256 newLimit = 5 ether;

        vm.expectEmit(false, false, false, true, address(s));
        emit SpendLimitChanged(DAILY_LIMIT, newLimit);

        vm.prank(owner);
        s.setDailySpendLimit(newLimit);

        assertEq(s.dailySpendLimit(), newLimit);
    }

    function test_SetDailySpendLimit_ZeroMeansUnlimited() public {
        vm.prank(owner);
        s.setDailySpendLimit(0);
        assertEq(s.dailySpendLimit(), 0);
    }

    function test_SetDailySpendLimit_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.setDailySpendLimit(0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Instruction Management
// ═══════════════════════════════════════════════════════════════════════════════

contract InstructionManagementTest is SuccessorBase {
    // ── addInstruction ────────────────────────────────────────────────────────

    function test_AddInstruction_StoresFieldsAndEmits() public {
        bytes memory data = hex"deadbeef";

        vm.expectEmit(true, false, false, true, address(s));
        emit InstructionAdded(0, stranger, data, ONE_ETHER, "Pay Alice");

        vm.prank(owner);
        s.addInstruction(stranger, data, ONE_ETHER, "Pay Alice");

        (
            address target,
            bytes memory storedData,
            uint256 value,
            string memory desc,
            bool executed,
            bool succeeded
        ) = s.instructions(0);

        assertEq(target,              stranger);
        assertEq(storedData,          data);
        assertEq(value,               ONE_ETHER);
        assertEq(desc,                "Pay Alice");
        assertFalse(executed);
        assertFalse(succeeded);
    }

    function test_AddInstruction_SequentialIndices() public {
        for (uint256 i; i < 5; i++) {
            vm.prank(owner);
            s.addInstruction(stranger, "", 0, "x");
        }
        assertEq(s.instructionCount(), 5);
    }

    function test_AddInstruction_RevertIf_ZeroTarget() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroAddress.selector);
        s.addInstruction(address(0), "", 0, "bad");
    }

    function test_AddInstruction_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.addInstruction(stranger, "", 0, "bad");
    }

    function test_AddInstruction_RevertIf_Triggered() public {
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.addInstruction(stranger, "", 0, "bad");
    }

    // ── removeInstruction ─────────────────────────────────────────────────────

    function test_RemoveInstruction_PreservesOrder() public {
        vm.startPrank(owner);
        s.addInstruction(stranger, "", 0, "A");
        s.addInstruction(stranger, "", 0, "B");
        s.addInstruction(stranger, "", 0, "C");

        vm.expectEmit(true, false, false, false, address(s));
        emit InstructionRemoved(0);

        s.removeInstruction(0);
        vm.stopPrank();

        assertEq(s.instructionCount(), 2);
        (,,,string memory desc0,, ) = s.instructions(0);
        (,,,string memory desc1,, ) = s.instructions(1);
        assertEq(desc0, "B");
        assertEq(desc1, "C");
    }

    function test_RemoveInstruction_LastElement() public {
        vm.startPrank(owner);
        s.addInstruction(stranger, "", 0, "A");
        s.addInstruction(stranger, "", 0, "B");
        s.removeInstruction(1);
        vm.stopPrank();
        assertEq(s.instructionCount(), 1);
        (,,,string memory d,,) = s.instructions(0);
        assertEq(d, "A");
    }

    function test_RemoveInstruction_RevertIf_OutOfBounds() public {
        vm.prank(owner);
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.removeInstruction(0);
    }

    function test_RemoveInstruction_RevertIf_NotOwner() public {
        vm.prank(owner);
        s.addInstruction(stranger, "", 0, "A");

        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.removeInstruction(0);
    }

    // ── reorderInstructions ───────────────────────────────────────────────────

    function test_ReorderInstructions_SwapsCorrectly() public {
        vm.startPrank(owner);
        s.addInstruction(stranger, "", 0, "First");
        s.addInstruction(stranger, "", 0, "Second");
        s.reorderInstructions(0, 1);
        vm.stopPrank();

        (,,,string memory d0,,) = s.instructions(0);
        (,,,string memory d1,,) = s.instructions(1);
        assertEq(d0, "Second");
        assertEq(d1, "First");
    }

    function test_ReorderInstructions_SameIndex_IsNoop() public {
        vm.prank(owner);
        s.addInstruction(stranger, "", 0, "Only");

        vm.prank(owner);
        s.reorderInstructions(0, 0); // should not revert
    }

    function test_ReorderInstructions_RevertIf_OutOfBounds() public {
        vm.prank(owner);
        s.addInstruction(stranger, "", 0, "A");

        vm.prank(owner);
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.reorderInstructions(0, 99);
    }

    function test_ReorderInstructions_RevertIf_NotOwner() public {
        vm.startPrank(owner);
        s.addInstruction(stranger, "", 0, "A");
        s.addInstruction(stranger, "", 0, "B");
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.reorderInstructions(0, 1);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. markMissedHeartbeat()
// ═══════════════════════════════════════════════════════════════════════════════

contract MarkMissedHeartbeatTest is SuccessorBase {
    function test_TransitionsToTriggeredAndEmits() public {
        _elapseGracePeriod();

        vm.expectEmit(false, false, false, true, address(s));
        emit HeartbeatMissed(block.timestamp);

        s.markMissedHeartbeat();

        assertEq(uint256(s.state()), uint256(Successor.State.TRIGGERED));
    }

    function test_AnyoneCanCall() public {
        _elapseGracePeriod();
        vm.prank(stranger);
        s.markMissedHeartbeat(); // must not revert
    }

    function test_RevertIf_GracePeriodNotElapsed() public {
        vm.expectRevert(Successor.GracePeriodNotElapsed.selector);
        s.markMissedHeartbeat();
    }

    function test_RevertIf_AlreadyTriggered() public {
        _elapseGracePeriod();
        s.markMissedHeartbeat();

        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.markMissedHeartbeat();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. approveWithdrawal()
// ═══════════════════════════════════════════════════════════════════════════════

contract ApproveWithdrawalTest is SuccessorBase {
    function test_SetsApprovedAndTransitionsToExecuting() public {
        _elapseGracePeriod();

        vm.expectEmit(true, false, false, true, address(s));
        emit WithdrawalApproved(relayer, block.timestamp);

        vm.prank(relayer);
        s.approveWithdrawal();

        assertTrue(s.withdrawalApproved());
        assertEq(uint256(s.state()), uint256(Successor.State.EXECUTING));
    }

    function test_WorksFromTriggeredState() public {
        _elapseGracePeriod();
        s.markMissedHeartbeat(); // TRIGGERED

        vm.prank(relayer);
        s.approveWithdrawal();

        assertTrue(s.withdrawalApproved());
        assertEq(uint256(s.state()), uint256(Successor.State.EXECUTING));
    }

    function test_RevertIf_NotRelayer() public {
        _elapseGracePeriod();

        vm.prank(stranger);
        vm.expectRevert(Successor.NotRelayer.selector);
        s.approveWithdrawal();
    }

    function test_RevertIf_GracePeriodNotElapsed() public {
        vm.prank(relayer);
        vm.expectRevert(Successor.GracePeriodNotElapsed.selector);
        s.approveWithdrawal();
    }

    function test_RevertIf_AlreadyApproved() public {
        _elapseGracePeriod();
        vm.prank(relayer);
        s.approveWithdrawal();

        vm.prank(relayer);
        vm.expectRevert(Successor.WithdrawalAlreadyApproved.selector);
        s.approveWithdrawal();
    }

    function test_RevertIf_Completed() public {
        _approveWithdrawal();
        _fund(ONE_ETHER);

        vm.prank(kin);
        s.withdraw(); // → COMPLETED

        vm.prank(relayer);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.approveWithdrawal();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. withdraw() and withdrawAmount()
// ═══════════════════════════════════════════════════════════════════════════════

contract WithdrawTest is SuccessorBase {
    function test_Withdraw_SendsFullBalanceAndEmits() public {
        _fund(5 ether);
        _approveWithdrawal();

        uint256 kinBefore = kin.balance;

        vm.expectEmit(true, false, false, true, address(s));
        emit WithdrawalExecuted(kin, 5 ether);

        vm.prank(kin);
        s.withdraw();

        assertEq(kin.balance, kinBefore + 5 ether);
        assertEq(address(s).balance, 0);
        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
        assertFalse(s.withdrawalApproved());
    }

    function test_Withdraw_AnyoneCanCall_WhenApproved() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();

        uint256 strangerBefore = stranger.balance;
        vm.prank(stranger);
        s.withdraw();

        assertEq(stranger.balance, strangerBefore + ONE_ETHER);
    }

    function test_Withdraw_ResetsApprovalFlag() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();

        vm.prank(kin);
        s.withdraw();

        assertFalse(s.withdrawalApproved());
    }

    function test_Withdraw_RevertIf_NotApproved() public {
        _fund(ONE_ETHER);
        _elapseGracePeriod();
        // approveWithdrawal NOT called

        vm.prank(kin);
        vm.expectRevert(Successor.WithdrawalNotApproved.selector);
        s.withdraw();
    }

    function test_Withdraw_RevertIf_NotExecuting() public {
        // Manually set withdrawalApproved without going through approveWithdrawal
        // is impossible from outside — but we can test the state guard by
        // calling withdraw before approveWithdrawal transitions state.
        _fund(ONE_ETHER);

        vm.prank(kin);
        vm.expectRevert(Successor.WithdrawalNotApproved.selector);
        s.withdraw();
    }

    function test_Withdraw_RevertIf_NothingToWithdraw() public {
        _approveWithdrawal();
        // No funds in contract

        vm.prank(kin);
        vm.expectRevert(Successor.NothingToWithdraw.selector);
        s.withdraw();
    }

    function test_WithdrawAmount_SendsPartialBalance() public {
        _fund(5 ether);
        _approveWithdrawal();

        uint256 kinBefore = kin.balance;

        vm.prank(kin);
        s.withdrawAmount(2 ether);

        assertEq(kin.balance, kinBefore + 2 ether);
        assertEq(address(s).balance, 3 ether);
        // Not COMPLETED because balance wasn't fully drained
        assertEq(uint256(s.state()), uint256(Successor.State.EXECUTING));
    }

    function test_WithdrawAmount_FullBalance_SetsCompleted() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();

        vm.prank(kin);
        s.withdrawAmount(ONE_ETHER);

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }

    function test_WithdrawAmount_RevertIf_ExceedsBalance() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();

        vm.prank(kin);
        vm.expectRevert(
            abi.encodeWithSelector(
                Successor.InsufficientContractBalance.selector,
                2 ether,
                ONE_ETHER
            )
        );
        s.withdrawAmount(2 ether);
    }

    function test_WithdrawAmount_RevertIf_ZeroAmount() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();

        vm.prank(kin);
        vm.expectRevert(Successor.NothingToWithdraw.selector);
        s.withdrawAmount(0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. executeAll()
// ═══════════════════════════════════════════════════════════════════════════════

contract ExecuteAllTest is SuccessorBase {
    function test_ExecuteAll_TransfersEthAndCompletesState() public {
        _fund(ONE_ETHER);
        _addTransfer(stranger, ONE_ETHER);
        _approveWithdrawal();

        uint256 balBefore = stranger.balance;

        vm.expectEmit(false, false, false, true, address(s));
        emit ExecutionCompleted(block.timestamp);

        s.executeAll();

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
        assertEq(stranger.balance, balBefore + ONE_ETHER);
    }

    function test_ExecuteAll_EmitsInstructionExecuted() public {
        _fund(ONE_ETHER);
        _addTransfer(stranger, ONE_ETHER);
        _approveWithdrawal();

        vm.expectEmit(true, false, false, true, address(s));
        emit InstructionExecuted(0, true, "");

        s.executeAll();
    }

    function test_ExecuteAll_SkipsAlreadyExecutedInstructions() public {
        _fund(ONE_ETHER);
        _addTransfer(stranger, ONE_ETHER);
        _approveWithdrawal();

        s.executeOne(0);
        s.executeAll(); // must not revert

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
        (,,,,bool executed, bool succeeded) = s.instructions(0);
        assertTrue(executed);
        assertTrue(succeeded);
    }

    function test_ExecuteAll_RecordsFailure_DoesNotRevert() public {
        RejectEther rejecter = new RejectEther();
        vm.prank(owner);
        s.addInstruction(address(rejecter), "", ONE_ETHER, "will fail");
        _fund(ONE_ETHER);
        _approveWithdrawal();

        s.executeAll();

        (,,,,bool executed, bool succeeded) = s.instructions(0);
        assertTrue(executed);
        assertFalse(succeeded);
        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }

    function test_ExecuteAll_RevertIf_NotExecuting() public {
        vm.expectRevert(Successor.NotInExecutingState.selector);
        s.executeAll();
    }

    function test_ExecuteAll_AnyoneCanCall_WhenExecuting() public {
        _approveWithdrawal();
        vm.prank(stranger);
        s.executeAll();
    }

    function test_ExecuteAll_EmptyQueue_StillCompletes() public {
        _approveWithdrawal();
        s.executeAll();
        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }

    function test_ExecuteAll_MultipleInstructions() public {
        AcceptEther acc = new AcceptEther();
        _fund(3 ether);

        for (uint256 i; i < 3; i++) {
            vm.prank(owner);
            s.addInstruction(address(acc), "", ONE_ETHER, "x");
        }

        _approveWithdrawal();
        s.executeAll();

        assertEq(acc.received(), 3 ether);
        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. executeOne()
// ═══════════════════════════════════════════════════════════════════════════════

contract ExecuteOneTest is SuccessorBase {
    function test_ExecuteOne_TransfersSingleInstruction() public {
        _fund(ONE_ETHER);
        _addTransfer(stranger, ONE_ETHER);
        _approveWithdrawal();

        uint256 balBefore = stranger.balance;
        s.executeOne(0);
        assertEq(stranger.balance, balBefore + ONE_ETHER);
    }

    function test_ExecuteOne_RevertIf_OutOfBounds() public {
        _approveWithdrawal();
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.executeOne(99);
    }

    function test_ExecuteOne_RevertIf_NotExecuting() public {
        _addTransfer(stranger, 0);
        vm.expectRevert(Successor.NotInExecutingState.selector);
        s.executeOne(0);
    }

    function test_ExecuteOne_SkipsAlreadyExecuted_Silently() public {
        _fund(ONE_ETHER);
        _addTransfer(stranger, ONE_ETHER);
        _approveWithdrawal();

        s.executeOne(0);
        uint256 balAfterFirst = stranger.balance;

        s.executeOne(0); // second call — must not transfer again
        assertEq(stranger.balance, balAfterFirst);
    }

    function test_ExecuteOne_RecordsCalldata() public {
        AcceptEther acc = new AcceptEther();
        bytes memory data = abi.encodeWithSignature("nonExistentFn()");

        vm.prank(owner);
        s.addInstruction(address(acc), data, 0, "calldata test");
        _approveWithdrawal();

        s.executeOne(0);

        (,,,,bool executed, bool succeeded) = s.instructions(0);
        assertTrue(executed);
        assertTrue(succeeded); // AcceptEther fallback accepts all calls
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Daily Spend Limit
// ═══════════════════════════════════════════════════════════════════════════════

contract SpendLimitTest is SuccessorBase {
    function test_RecordsFailure_WhenExceedsLimit() public {
        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 0.5 ether);
        vm.deal(address(s2), ONE_ETHER);

        vm.prank(owner);
        s2.addInstruction(stranger, "", ONE_ETHER, "too big");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeAll();

        (,,,,bool executed, bool succeeded) = s2.instructions(0);
        assertTrue(executed);
        assertFalse(succeeded);
    }

    function test_RecordsFailure_WhenInsufficientBalance() public {
        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 0);

        vm.prank(owner);
        s2.addInstruction(stranger, "", ONE_ETHER, "no funds");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeAll();

        (,,,,bool executed, bool succeeded) = s2.instructions(0);
        assertTrue(executed);
        assertFalse(succeeded);
    }

    function test_SpendWindowResets_After24Hours() public {
        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, ONE_ETHER);
        vm.deal(address(s2), 2 ether);

        vm.prank(owner);
        s2.addInstruction(stranger, "", ONE_ETHER, "first");
        vm.prank(owner);
        s2.addInstruction(stranger, "", ONE_ETHER, "second");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeOne(0);
        (,,,,, bool ok0) = s2.instructions(0);
        assertTrue(ok0);

        vm.warp(block.timestamp + 25 hours);

        s2.executeOne(1);
        (,,,,, bool ok1) = s2.instructions(1);
        assertTrue(ok1);
    }

    function test_RemainingAllowance_IsMaxUint_WhenLimitZero() public {
        assertEq(
            new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 0).remainingDailyAllowance(),
            type(uint256).max
        );
    }

    function test_RemainingAllowance_DecreasesAfterSpend() public {
        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 5 ether);
        vm.deal(address(s2), 5 ether);

        vm.prank(owner);
        s2.addInstruction(stranger, "", 2 ether, "pay");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeOne(0);
        assertEq(s2.remainingDailyAllowance(), 3 ether);
    }

    function test_RemainingAllowance_ResetsAfterWindow() public {
        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, 5 ether);
        vm.deal(address(s2), 5 ether);

        vm.prank(owner);
        s2.addInstruction(stranger, "", 2 ether, "pay");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeOne(0);
        vm.warp(block.timestamp + 25 hours);
        assertEq(s2.remainingDailyAllowance(), 5 ether);
    }

    function test_Fuzz_SpendLimit(uint128 limit, uint128 spend) public {
        vm.assume(limit > 0 && spend > 0 && spend <= 100 ether);

        vm.prank(owner);
        Successor s2 = new Successor(KIN_EMAIL, relayer, SEVEN_DAYS, uint256(limit));
        vm.deal(address(s2), uint256(spend));

        vm.prank(owner);
        s2.addInstruction(stranger, "", uint256(spend), "fuzz");

        vm.warp(block.timestamp + SEVEN_DAYS + 1);
        vm.prank(relayer);
        s2.approveWithdrawal();

        s2.executeAll();

        (,,,,bool executed,) = s2.instructions(0);
        assertTrue(executed);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. View Helpers – getStatus() / instructionCount()
// ═══════════════════════════════════════════════════════════════════════════════

contract ViewHelpersTest is SuccessorBase {
    function test_GetStatus_WhileActive() public view {
        (bool triggered, Successor.State state_, uint256 timeRemaining, uint256 total, bool approvalPending) =
            s.getStatus();

        assertFalse(triggered);
        assertEq(uint256(state_), uint256(Successor.State.ACTIVE));
        assertGt(timeRemaining, 0);
        assertEq(total, 0);
        assertFalse(approvalPending);
    }

    function test_GetStatus_AfterGracePeriodElapses() public {
        _elapseGracePeriod();
        (bool triggered,, uint256 timeRemaining,,) = s.getStatus();
        assertTrue(triggered);
        assertEq(timeRemaining, 0);
    }

    function test_GetStatus_ApprovalPending_AfterApprove() public {
        _approveWithdrawal();
        (,,,, bool approvalPending) = s.getStatus();
        assertTrue(approvalPending);
    }

    function test_GetStatus_InExecutingState() public {
        _approveWithdrawal();
        (, Successor.State state_,,,) = s.getStatus();
        assertEq(uint256(state_), uint256(Successor.State.EXECUTING));
    }

    function test_GetStatus_InCompletedState() public {
        _fund(ONE_ETHER);
        _approveWithdrawal();
        vm.prank(kin);
        s.withdraw();
        (, Successor.State state_,,,) = s.getStatus();
        assertEq(uint256(state_), uint256(Successor.State.COMPLETED));
    }

    function test_GetStatus_TotalInstructionsMatchesCount() public {
        for (uint256 i; i < 4; i++) {
            vm.prank(owner);
            s.addInstruction(stranger, "", 0, "x");
        }
        (,,, uint256 total,) = s.getStatus();
        assertEq(total, 4);
        assertEq(s.instructionCount(), 4);
    }

    function test_InstructionCount_ZeroOnDeploy() public view {
        assertEq(s.instructionCount(), 0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Full Lifecycle Integration
// ═══════════════════════════════════════════════════════════════════════════════

contract LifecycleTest is SuccessorBase {
    function test_FullHappyPath_AgentApproves_KinWithdraws() public {
        _fund(3 ether);
        _addTransfer(stranger, ONE_ETHER);
        _addTransfer(kin,      ONE_ETHER);

        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        s.ping();

        _elapseGracePeriod();
        s.markMissedHeartbeat();
        assertEq(uint256(s.state()), uint256(Successor.State.TRIGGERED));

        vm.prank(relayer);
        s.approveWithdrawal();
        assertTrue(s.withdrawalApproved());
        assertEq(uint256(s.state()), uint256(Successor.State.EXECUTING));

        uint256 kinBefore = kin.balance;
        vm.prank(kin);
        s.withdraw();

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
        assertEq(kin.balance, kinBefore + 3 ether);
    }

    function test_FullHappyPath_AgentApproves_ExecuteAll() public {
        _fund(3 ether);
        _addTransfer(stranger, ONE_ETHER);
        _addTransfer(kin,      ONE_ETHER);

        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        s.ping();

        _elapseGracePeriod();
        vm.prank(relayer);
        s.approveWithdrawal();

        uint256 strangerBal = stranger.balance;
        vm.prank(stranger);
        s.executeAll();

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
        assertEq(stranger.balance, strangerBal + ONE_ETHER);
    }

    function test_PingAfterLongAbsence_ResetsGracePeriod() public {
        vm.warp(s.lastPing() + SEVEN_DAYS - 1 hours);
        vm.prank(owner);
        s.ping();

        (bool triggered,,uint256 remaining,,) = s.getStatus();
        assertFalse(triggered);
        assertGt(remaining, 0);
    }

    function test_PartialExecution_ViaExecuteOne() public {
        _fund(3 ether);
        for (uint256 i; i < 3; i++) {
            _addTransfer(stranger, ONE_ETHER);
        }
        _approveWithdrawal();

        for (uint256 i; i < 3; i++) {
            s.executeOne(i);
        }

        assertEq(uint256(s.state()), uint256(Successor.State.EXECUTING));

        for (uint256 i; i < 3; i++) {
            (,,,,bool executed, bool succeeded) = s.instructions(i);
            assertTrue(executed);
            assertTrue(succeeded);
        }
    }

    function test_MixedSuccess_And_Failure_Batch() public {
        AcceptEther acc      = new AcceptEther();
        RejectEther rejecter = new RejectEther();

        _fund(ONE_ETHER);

        vm.startPrank(owner);
        s.addInstruction(address(acc),      "", ONE_ETHER, "will succeed");
        s.addInstruction(address(rejecter), "", 0,         "will fail");
        vm.stopPrank();

        _approveWithdrawal();
        s.executeAll();

        (,,,,bool e0, bool ok0) = s.instructions(0);
        (,,,,bool e1, bool ok1) = s.instructions(1);

        assertTrue(e0);  assertTrue(ok0);
        assertTrue(e1);  assertFalse(ok1);

        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }

    function test_ChangeRelayer_ThenNewRelayerApproves() public {
        address newRelayer = makeAddr("newRelayer");
        vm.prank(owner);
        s.setRelayer(newRelayer);

        _elapseGracePeriod();

        vm.prank(relayer);
        vm.expectRevert(Successor.NotRelayer.selector);
        s.approveWithdrawal();

        vm.prank(newRelayer);
        s.approveWithdrawal();
        assertTrue(s.withdrawalApproved());
    }

    function test_NoInstructions_ExecuteAll_StillCompletes() public {
        _approveWithdrawal();
        s.executeAll();
        assertEq(uint256(s.state()), uint256(Successor.State.COMPLETED));
    }
}
