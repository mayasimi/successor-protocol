// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console2} from "forge-std/Test.sol";
import {Successor} from "../src/Successor.sol";

// ─── Helper contracts ─────────────────────────────────────────────────────────

/// @dev Accepts ETH – used as a benign instruction target.
contract Receiver {
    uint256 public received;
    receive() external payable { received += msg.value; }
}

/// @dev Reverts on every call – used to test failure recording.
contract Reverter {
    receive() external payable { revert("always reverts"); }
    fallback() external payable { revert("always reverts"); }
}

/// @dev Attempts to re-enter executeAll() on receive().
contract ReentrancyAttacker {
    Successor public immutable target;
    bool public attacked;

    constructor(address _target) { target = Successor(payable(_target)); }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // This inner call MUST revert due to ReentrancyGuard.
            try target.executeAll() {} catch {}
        }
    }
}

// ─── Main test suite ──────────────────────────────────────────────────────────

contract SuccessorTest is Test {

    // ── Mirror events for expectEmit ──────────────────────────────────────────
    // Solidity 0.8.19 cannot reference events via `ContractName.EventName` in
    // emit statements, so we redeclare them here for use with vm.expectEmit.

    event HeartbeatPing(address indexed owner, uint256 timestamp);
    event GracePeriodChanged(uint256 oldPeriod, uint256 newPeriod);
    event KinAddressChanged(address indexed oldKin, address indexed newKin);
    event DeathVerified(address indexed kin, uint256 timestamp);
    event InstructionAdded(uint256 indexed index, address target, bytes data, uint256 value, string description);
    event InstructionRemoved(uint256 indexed index);
    event InstructionExecuted(uint256 indexed index, bool success, bytes returnData);
    event SpendLimitChanged(uint256 oldLimit, uint256 newLimit);
    event ExecutionCompleted(uint256 timestamp);
    event Deposited(address indexed sender, uint256 amount);

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 constant GRACE   = 7 days;
    uint256 constant LIMIT   = 1 ether;
    uint256 constant ONE_DAY = 1 days;

    // ── Actors ────────────────────────────────────────────────────────────────

    address owner     = makeAddr("owner");
    address kin       = makeAddr("kin");
    address stranger  = makeAddr("stranger");
    address recipient = makeAddr("recipient");

    // ── State ─────────────────────────────────────────────────────────────────

    Successor s;

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        vm.prank(owner);
        s = new Successor(kin, GRACE, LIMIT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Deployment
    // ─────────────────────────────────────────────────────────────────────────

    function test_deployment_setsParams() public view {
        assertEq(s.owner(),          owner);
        assertEq(s.kinAddress(),     kin);
        assertEq(s.gracePeriod(),    GRACE);
        assertEq(s.dailySpendLimit(), LIMIT);
        assertEq(uint8(s.state()),   uint8(Successor.State.ACTIVE));
    }

    function test_deployment_lastPingIsNow() public view {
        assertEq(s.lastPing(), block.timestamp);
    }

    function test_deployment_revertsOnZeroKin() public {
        vm.expectRevert(Successor.ZeroAddress.selector);
        new Successor(address(0), GRACE, LIMIT);
    }

    function test_deployment_revertsOnZeroGrace() public {
        vm.expectRevert(Successor.ZeroGracePeriod.selector);
        new Successor(kin, 0, LIMIT);
    }

    function test_deployment_zeroSpendLimitIsAllowed() public {
        Successor s2 = new Successor(kin, GRACE, 0);
        assertEq(s2.dailySpendLimit(), 0);
        assertEq(s2.remainingDailyAllowance(), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Heartbeat – ping()
    // ─────────────────────────────────────────────────────────────────────────

    function test_ping_updatesLastPing() public {
        skip(1000);
        vm.prank(owner);
        s.ping();
        assertEq(s.lastPing(), block.timestamp);
    }

    function test_ping_emitsEvent() public {
        skip(1);
        vm.expectEmit(true, false, false, true, address(s));
        emit HeartbeatPing(owner, block.timestamp + 1);
        skip(1);
        vm.prank(owner);
        s.ping();
    }

    function test_ping_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.ping();
    }

    function test_ping_revertsAfterVerifyDeath() public {
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.ping();
    }

    function test_ping_canPingMultipleTimes() public {
        for (uint256 i = 0; i < 5; i++) {
            skip(1 days);
            vm.prank(owner);
            s.ping();
        }
        assertEq(s.lastPing(), block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Configuration
    // ─────────────────────────────────────────────────────────────────────────

    function test_setGracePeriod_updatesAndEmits() public {
        uint256 newPeriod = 14 days;
        vm.expectEmit(false, false, false, true, address(s));
        emit GracePeriodChanged(GRACE, newPeriod);
        vm.prank(owner);
        s.setGracePeriod(newPeriod);
        assertEq(s.gracePeriod(), newPeriod);
    }

    function test_setGracePeriod_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroGracePeriod.selector);
        s.setGracePeriod(0);
    }

    function test_setGracePeriod_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.setGracePeriod(14 days);
    }

    function test_setGracePeriod_revertsAfterTrigger() public {
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.setGracePeriod(1 days);
    }

    function test_setKinAddress_updatesAndEmits() public {
        vm.expectEmit(true, true, false, false, address(s));
        emit KinAddressChanged(kin, stranger);
        vm.prank(owner);
        s.setKinAddress(stranger);
        assertEq(s.kinAddress(), stranger);
    }

    function test_setKinAddress_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroAddress.selector);
        s.setKinAddress(address(0));
    }

    function test_setKinAddress_revertsAfterTrigger() public {
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.setKinAddress(stranger);
    }

    function test_setDailySpendLimit_updatesAndEmits() public {
        uint256 newLimit = 2 ether;
        vm.expectEmit(false, false, false, true, address(s));
        emit SpendLimitChanged(LIMIT, newLimit);
        vm.prank(owner);
        s.setDailySpendLimit(newLimit);
        assertEq(s.dailySpendLimit(), newLimit);
    }

    function test_setDailySpendLimit_revertsAfterTrigger() public {
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.setDailySpendLimit(5 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Instruction management
    // ─────────────────────────────────────────────────────────────────────────

    function test_addInstruction_appendsAndEmits() public {
        vm.expectEmit(true, false, false, false, address(s));
        emit InstructionAdded(0, recipient, bytes(""), 0, "test");
        vm.prank(owner);
        s.addInstruction(recipient, bytes(""), 0, "test");
        assertEq(s.instructionCount(), 1);
    }

    function test_addInstruction_revertsOnZeroTarget() public {
        vm.prank(owner);
        vm.expectRevert(Successor.ZeroAddress.selector);
        s.addInstruction(address(0), bytes(""), 0, "bad");
    }

    function test_addInstruction_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Successor.NotOwner.selector);
        s.addInstruction(recipient, bytes(""), 0, "hack");
    }

    function test_addInstruction_revertsAfterTrigger() public {
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.addInstruction(recipient, bytes(""), 0, "late");
    }

    function test_removeInstruction_shiftsAndEmits() public {
        _addThreeInstructions();

        vm.expectEmit(true, false, false, false, address(s));
        emit InstructionRemoved(1);
        vm.prank(owner);
        s.removeInstruction(1);

        assertEq(s.instructionCount(), 2);
        (address t0,,,string memory d0,,) = s.instructions(0);
        (address t1,,,string memory d1,,) = s.instructions(1);
        assertEq(d0, "A");
        assertEq(d1, "C");
        assertEq(t0, recipient);
        assertEq(t1, recipient);
    }

    function test_removeInstruction_revertsOutOfBounds() public {
        vm.prank(owner);
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.removeInstruction(0);
    }

    function test_removeInstruction_revertsAfterTrigger() public {
        _addThreeInstructions();
        _triggerAndVerify();
        vm.prank(owner);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.removeInstruction(0);
    }

    function test_reorderInstructions_swaps() public {
        _addThreeInstructions();
        vm.prank(owner);
        s.reorderInstructions(0, 2);

        (,,,string memory d0,,) = s.instructions(0);
        (,,,string memory d2,,) = s.instructions(2);
        assertEq(d0, "C");
        assertEq(d2, "A");
    }

    function test_reorderInstructions_noopSameIndex() public {
        _addThreeInstructions();
        vm.prank(owner);
        s.reorderInstructions(1, 1); // should not revert
        assertEq(s.instructionCount(), 3);
    }

    function test_reorderInstructions_revertsOutOfBounds() public {
        _addThreeInstructions();
        vm.prank(owner);
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.reorderInstructions(0, 99);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. getStatus()
    // ─────────────────────────────────────────────────────────────────────────

    function test_getStatus_activeBeforeGrace() public view {
        (bool triggered, Successor.State st, uint256 remaining,) = s.getStatus();
        assertFalse(triggered);
        assertEq(uint8(st), uint8(Successor.State.ACTIVE));
        assertGt(remaining, 0);
    }

    function test_getStatus_triggeredAfterGrace() public {
        skip(GRACE + 1);
        (bool triggered,, uint256 remaining,) = s.getStatus();
        assertTrue(triggered);
        assertEq(remaining, 0);
    }

    function test_getStatus_instructionCountUpdates() public {
        _addThreeInstructions();
        (,,, uint256 total) = s.getStatus();
        assertEq(total, 3);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. verifyDeath()
    // ─────────────────────────────────────────────────────────────────────────

    function test_verifyDeath_revertsBeforeGrace() public {
        vm.prank(kin);
        vm.expectRevert(Successor.GracePeriodNotElapsed.selector);
        s.verifyDeath();
    }

    function test_verifyDeath_revertsForNonKin() public {
        skip(GRACE + 1);
        vm.prank(stranger);
        vm.expectRevert(Successor.NotKin.selector);
        s.verifyDeath();
    }

    function test_verifyDeath_revertsForOwner() public {
        skip(GRACE + 1);
        vm.prank(owner);
        vm.expectRevert(Successor.NotKin.selector);
        s.verifyDeath();
    }

    function test_verifyDeath_transitionsToExecuting() public {
        skip(GRACE + 1);
        vm.expectEmit(true, false, false, true, address(s));
        emit DeathVerified(kin, block.timestamp);
        vm.prank(kin);
        s.verifyDeath();
        assertEq(uint8(s.state()), uint8(Successor.State.EXECUTING));
    }

    function test_verifyDeath_revertsIfAlreadyExecuting() public {
        _triggerAndVerify();
        vm.prank(kin);
        vm.expectRevert(Successor.AlreadyTriggered.selector);
        s.verifyDeath();
    }

    function test_verifyDeath_exactlyAtGraceBoundary() public {
        skip(GRACE); // exactly at deadline
        vm.prank(kin);
        s.verifyDeath(); // must succeed
        assertEq(uint8(s.state()), uint8(Successor.State.EXECUTING));
    }

    function test_verifyDeath_oneSecondBeforeGrace() public {
        skip(GRACE - 1);
        vm.prank(kin);
        vm.expectRevert(Successor.GracePeriodNotElapsed.selector);
        s.verifyDeath();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. executeAll() / executeOne()
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeAll_revertsWhenNotExecuting() public {
        vm.expectRevert(Successor.NotInExecutingState.selector);
        s.executeAll();
    }

    function test_executeAll_executesAndTransitionsToCompleted() public {
        Receiver r = new Receiver();
        _fund(5 ether);
        _addInstruction(address(r), bytes(""), 0.5 ether, "send");
        _triggerAndVerify();

        uint256 before = address(r).balance;
        vm.expectEmit(false, false, false, false, address(s));
        emit ExecutionCompleted(block.timestamp);
        s.executeAll();

        assertEq(uint8(s.state()), uint8(Successor.State.COMPLETED));
        assertEq(address(r).balance - before, 0.5 ether);
    }

    function test_executeAll_recordsFailureButContinues() public {
        Reverter rev = new Reverter();
        Receiver rec = new Receiver();
        _fund(1 ether);
        _addInstruction(address(rev), bytes(""), 0.1 ether, "will fail");
        _addInstruction(address(rec), bytes(""), 0.1 ether, "will succeed");
        _triggerAndVerify();

        s.executeAll();

        (,,,, bool ex0, bool ok0) = s.instructions(0);
        (,,,, bool ex1, bool ok1) = s.instructions(1);
        assertTrue(ex0);  assertFalse(ok0); // failed
        assertTrue(ex1);  assertTrue(ok1);  // succeeded
        assertEq(uint8(s.state()), uint8(Successor.State.COMPLETED));
    }

    function test_executeAll_skipsAlreadyExecuted() public {
        Receiver r = new Receiver();
        _fund(2 ether);
        _addInstruction(address(r), bytes(""), 0.1 ether, "inst");
        _triggerAndVerify();

        s.executeOne(0); // execute manually first
        uint256 balBefore = address(r).balance;
        s.executeAll();  // should skip index 0
        assertEq(address(r).balance, balBefore); // no double-send
    }

    function test_executeOne_revertsOutOfBounds() public {
        _triggerAndVerify();
        vm.expectRevert(Successor.InstructionIndexOutOfBounds.selector);
        s.executeOne(0);
    }

    function test_executeOne_revertsWhenNotExecuting() public {
        _addInstruction(recipient, bytes(""), 0, "inst");
        vm.expectRevert(Successor.NotInExecutingState.selector);
        s.executeOne(0);
    }

    function test_executeAll_callableByAnyone() public {
        _triggerAndVerify();
        vm.prank(stranger);
        s.executeAll(); // no instructions, should still complete
        assertEq(uint8(s.state()), uint8(Successor.State.COMPLETED));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Spending limit
    // ─────────────────────────────────────────────────────────────────────────

    function test_spendLimit_blocksExceedingInstruction() public {
        Receiver r = new Receiver();
        _fund(10 ether);
        // Two instructions each spending 0.8 ether; limit is 1 ether
        _addInstruction(address(r), bytes(""), 0.8 ether, "first");
        _addInstruction(address(r), bytes(""), 0.8 ether, "second");
        _triggerAndVerify();

        s.executeAll();

        (,,,, bool ex0, bool ok0) = s.instructions(0);
        (,,,, bool ex1, bool ok1) = s.instructions(1);
        assertTrue(ex0); assertTrue(ok0);   // 0.8 ether – within limit
        assertTrue(ex1); assertFalse(ok1);  // 0.8 ether – would exceed 1 ether limit
    }

    function test_spendLimit_resetsAfter24Hours() public {
        Receiver r = new Receiver();
        _fund(10 ether);
        _addInstruction(address(r), bytes(""), 0.8 ether, "first");
        _addInstruction(address(r), bytes(""), 0.8 ether, "second");
        _triggerAndVerify();

        s.executeOne(0); // spends 0.8 ether

        skip(ONE_DAY + 1); // window resets

        s.executeOne(1); // 0.8 ether again – now allowed
        (,,,, bool ex1, bool ok1) = s.instructions(1);
        assertTrue(ex1); assertTrue(ok1);
    }

    function test_spendLimit_zeroMeansUnlimited() public {
        vm.prank(owner);
        Successor s2 = new Successor(kin, GRACE, 0);
        vm.deal(address(s2), 100 ether);

        Receiver r = new Receiver();
        vm.prank(owner);
        s2.addInstruction(address(r), bytes(""), 50 ether, "big");
        vm.prank(owner);
        s2.addInstruction(address(r), bytes(""), 50 ether, "bigger");

        skip(GRACE + 1);
        vm.prank(kin);
        s2.verifyDeath();
        s2.executeAll();

        (,,,, bool ex0, bool ok0) = s2.instructions(0);
        (,,,, bool ex1, bool ok1) = s2.instructions(1);
        assertTrue(ok0); assertTrue(ok1);
    }

    function test_spendLimit_insufficientBalance() public {
        Receiver r = new Receiver();
        // Fund only 0.1 ether but instruction wants 0.5 ether
        _fund(0.1 ether);
        _addInstruction(address(r), bytes(""), 0.5 ether, "too big");
        _triggerAndVerify();

        s.executeAll();

        (,,,, bool ex0, bool ok0) = s.instructions(0);
        assertTrue(ex0); assertFalse(ok0); // recorded as failed
    }

    function test_remainingDailyAllowance_decreasesAfterExecution() public {
        Receiver r = new Receiver();
        _fund(5 ether);
        _addInstruction(address(r), bytes(""), 0.3 ether, "spend");
        _triggerAndVerify();

        uint256 before = s.remainingDailyAllowance();
        s.executeOne(0);
        uint256 afterExec = s.remainingDailyAllowance();

        assertEq(before - afterExec, 0.3 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Reentrancy protection
    // ─────────────────────────────────────────────────────────────────────────

    function test_reentrancy_executeAllIsProtected() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(s));
        _fund(2 ether);
        _addInstruction(address(attacker), bytes(""), 0.1 ether, "attack");
        _triggerAndVerify();

        // Should not revert – the outer call succeeds, inner reentrant call is blocked
        s.executeAll();
        assertTrue(attacker.attacked()); // attacker's receive() was called
        assertEq(uint8(s.state()), uint8(Successor.State.COMPLETED));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Receive / deposit
    // ─────────────────────────────────────────────────────────────────────────

    function test_receive_acceptsEth() public {
        vm.deal(stranger, 1 ether);
        vm.expectEmit(true, false, false, true, address(s));
        emit Deposited(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(s).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(s).balance, 1 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Grace period must always be respected.
    function testFuzz_verifyDeath_respectsGracePeriod(
        uint256 elapsed,
        uint256 grace
    ) public {
        grace   = bound(grace,   1,      365 days);
        elapsed = bound(elapsed, 0,      grace * 2);

        vm.prank(owner);
        Successor fs = new Successor(kin, grace, 0);

        skip(elapsed);
        vm.prank(kin);

        if (elapsed >= grace) {
            fs.verifyDeath(); // must succeed
            assertEq(uint8(fs.state()), uint8(Successor.State.EXECUTING));
        } else {
            vm.expectRevert(Successor.GracePeriodNotElapsed.selector);
            fs.verifyDeath();
        }
    }

    /// @dev Ping always resets lastPing to block.timestamp.
    function testFuzz_ping_alwaysUpdatesTimestamp(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, GRACE - 1);
        skip(elapsed);
        vm.prank(owner);
        s.ping();
        assertEq(s.lastPing(), block.timestamp);
    }

    /// @dev Spend limit is always enforced correctly.
    function testFuzz_spendLimit_enforcement(
        uint256 limit,
        uint256 spend1,
        uint256 spend2
    ) public {
        limit  = bound(limit,  0.01 ether, 10 ether);
        spend1 = bound(spend1, 0.001 ether, limit);
        spend2 = bound(spend2, 0.001 ether, limit);

        Receiver r = new Receiver();
        vm.prank(owner);
        Successor fs = new Successor(kin, GRACE, limit);
        vm.deal(address(fs), 100 ether);

        vm.prank(owner);
        fs.addInstruction(address(r), bytes(""), spend1, "s1");
        vm.prank(owner);
        fs.addInstruction(address(r), bytes(""), spend2, "s2");

        skip(GRACE + 1);
        vm.prank(kin);
        fs.verifyDeath();
        fs.executeAll();

        (,,,, bool ex0, bool ok0) = fs.instructions(0);
        (,,,, bool ex1, bool ok1) = fs.instructions(1);

        assertTrue(ex0); assertTrue(ok0); // first always fits (spend1 <= limit)

        if (spend1 + spend2 <= limit) {
            assertTrue(ok1);
        } else {
            assertFalse(ok1);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. End-to-end lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_e2e_fullLifecycle() public {
        Receiver r = new Receiver();

        // Fund
        vm.deal(address(s), 5 ether);

        // Owner pings a few times
        skip(1 days); vm.prank(owner); s.ping();
        skip(1 days); vm.prank(owner); s.ping();

        // Add instructions
        vm.prank(owner);
        s.addInstruction(address(r), bytes(""), 0.5 ether, "Transfer 0.5 ZG");
        vm.prank(owner);
        s.addInstruction(recipient, bytes(""), 0, "Notify");

        // Status is ACTIVE
        (bool triggered, Successor.State st,,) = s.getStatus();
        assertFalse(triggered);
        assertEq(uint8(st), uint8(Successor.State.ACTIVE));

        // Owner stops pinging – grace period elapses
        skip(GRACE + 1);
        (triggered,,,) = s.getStatus();
        assertTrue(triggered);

        // Kin verifies death
        vm.prank(kin);
        s.verifyDeath();
        assertEq(uint8(s.state()), uint8(Successor.State.EXECUTING));

        // Anyone executes
        uint256 rBefore = address(r).balance;
        vm.prank(stranger);
        s.executeAll();

        assertEq(uint8(s.state()), uint8(Successor.State.COMPLETED));
        assertEq(address(r).balance - rBefore, 0.5 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _fund(uint256 amount) internal {
        vm.deal(address(s), amount);
    }

    function _addInstruction(
        address target,
        bytes memory data,
        uint256 value,
        string memory desc
    ) internal {
        vm.prank(owner);
        s.addInstruction(target, data, value, desc);
    }

    function _addThreeInstructions() internal {
        _addInstruction(recipient, bytes(""), 0, "A");
        _addInstruction(recipient, bytes(""), 0, "B");
        _addInstruction(recipient, bytes(""), 0, "C");
    }

    function _triggerAndVerify() internal {
        skip(GRACE + 1);
        vm.prank(kin);
        s.verifyDeath();
    }
}
