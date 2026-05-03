// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Test helper: attempts to re-enter Successor.executeAll() on receive().
 *      The outer call should succeed; the inner reentrant call should revert
 *      due to ReentrancyGuard, proving the guard works.
 */
interface ISuccessor {
    function executeAll() external;
}

contract ReentrancyAttacker {
    ISuccessor public immutable target;
    bool public attacked;

    constructor(address _target) {
        target = ISuccessor(_target);
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // This reentrant call MUST revert with "ReentrancyGuard: reentrant call"
            // We swallow the revert so the outer instruction still "succeeds" (ETH received).
            try target.executeAll() {} catch {}
        }
    }
}
