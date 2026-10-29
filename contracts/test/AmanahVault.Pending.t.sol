// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AmanahVaultTestBase} from "./AmanahVault.Base.t.sol";
import {AmanahVault} from "../AmanahVault.sol";

// ===========================================================================
// 16 new tests covering the pending-release window feature.
// ===========================================================================
contract AmanahVaultPendingTest is AmanahVaultTestBase {

    // =========================================================================
    // Test 1 — startRelease before deadline reverts NotOverdue
    // =========================================================================
    function test_startRelease_beforeDeadline_reverts() public {
        uint256 vid = _createSimpleVault();

        // Still inside the check-in interval — should revert NotOverdue
        vm.expectRevert(AmanahVault.NotOverdue.selector);
        aVault.startRelease(vid);
    }

    // =========================================================================
    // Test 2 — startRelease after deadline sets pendingSince, emits event
    // =========================================================================
    function test_startRelease_afterDeadline_succeeds() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);

        vm.warp(lastCheckIn + INTERVAL + 1);
        uint256 nowTs = block.timestamp;

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.PendingReleaseStarted(vid, address(this), nowTs, pWindow);

        aVault.startRelease(vid);

        (,,,,uint256 pSince,,) = _vaultFields(vid);
        assertEq(pSince, nowTs);
    }

    // =========================================================================
    // Test 3 — second startRelease reverts AlreadyPending
    // =========================================================================
    function test_startRelease_alreadyPending_reverts() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);

        aVault.startRelease(vid);  // first call succeeds

        vm.expectRevert(AmanahVault.AlreadyPending.selector);
        aVault.startRelease(vid);  // second call reverts
    }

    // =========================================================================
    // Test 4 — finalizeRelease before pendingWindow elapsed reverts
    // =========================================================================
    function test_finalizeRelease_beforeWindowElapsed_reverts() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);

        aVault.startRelease(vid);

        // Still inside the pending window — advance by pWindow - 1 second
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow - 1);

        vm.expectRevert(AmanahVault.PendingWindowNotElapsed.selector);
        aVault.finalizeRelease(vid);
    }

    // =========================================================================
    // Test 5 — full happy path: create, deposit, startRelease, finalizeRelease,
    //          verify claimable balances
    // =========================================================================
    function test_finalizeRelease_afterWindow_distributes() public {
        uint256 vid = _createTwoBeneficiaryVault(); // alice 60%, bob 40%
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        // Wait past check-in interval
        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);

        // Wait past pending window
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Released(vid, address(this), DEPOSIT_AMOUNT, 2);

        aVault.finalizeRelease(vid);

        // Verify state
        (,,,,,bool released, bool active) = _vaultFields(vid);
        assertTrue(released);
        assertFalse(active);
        assertEq(aVault.vaultBalance(vid), 0);

        uint256 aliceExpected = (DEPOSIT_AMOUNT * 6_000) / 10_000;
        uint256 bobExpected   = DEPOSIT_AMOUNT - aliceExpected;
        assertEq(aVault.claimable(vid, alice), aliceExpected);
        assertEq(aVault.claimable(vid, bob),   bobExpected);
    }

    // =========================================================================
    // Test 6 — checkIn during window resets pendingSince=0, emits ReleaseCancelled
    // =========================================================================
    function test_checkIn_cancelsPending() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);

        aVault.startRelease(vid);
        (,,,,uint256 pSince,,) = _vaultFields(vid);

        // Advance to halfway through the pending window (still inside it)
        vm.warp(pSince + pWindow / 2);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.ReleaseCancelled(vid, owner);

        vm.prank(owner);
        aVault.checkIn(vid);

        // pendingSince should be reset to 0
        (,,,,uint256 pSinceAfter,,) = _vaultFields(vid);
        assertEq(pSinceAfter, 0);
    }

    // =========================================================================
    // Test 7 — checkIn after pending window expired reverts PendingWindowNotElapsed
    // =========================================================================
    function test_checkIn_afterWindowExpired_reverts() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);

        aVault.startRelease(vid);
        (,,,,uint256 pSince,,) = _vaultFields(vid);

        // Advance past the pending window
        vm.warp(pSince + pWindow + 1);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.PendingWindowNotElapsed.selector);
        aVault.checkIn(vid);
    }

    // =========================================================================
    // Test 8 — owner CAN withdraw while pendingSince != 0 and window not elapsed
    // =========================================================================
    function test_withdraw_duringPendingWindow_succeeds() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);

        // Still inside the pending window
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow / 2);

        uint256 balBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT / 2); // should NOT revert

        assertEq(usdc.balanceOf(owner), balBefore + DEPOSIT_AMOUNT / 2);
        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT / 2);
    }

    // =========================================================================
    // Test 9 — owner CANNOT withdraw after pendingWindow elapsed
    // =========================================================================
    function test_withdraw_afterWindowExpired_reverts() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);

        (,,,,uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.PendingWindowNotElapsed.selector);
        aVault.withdraw(vid, DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // Test 10 — owner CANNOT updateBeneficiaries after pendingWindow elapsed
    // =========================================================================
    function test_updateBeneficiaries_afterWindowExpired_reverts() public {
        uint256 vid = _createSimpleVault();

        (, uint256 lastCheckIn,, uint256 pWindow,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);

        (,,,,uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);

        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = bob; shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.PendingWindowNotElapsed.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    // =========================================================================
    // Test 11 — second finalizeRelease reverts AlreadyReleased
    // =========================================================================
    function test_doubleFinalizeRelease_reverts() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        vm.expectRevert(AmanahVault.AlreadyReleased.selector);
        aVault.finalizeRelease(vid);
    }

    // =========================================================================
    // Test 12 — createVault with _pendingWindow=59 reverts PendingWindowTooShort
    // =========================================================================
    function test_createVault_pendingWindowTooShort_reverts() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.PendingWindowTooShort.selector);
        aVault.createVault(wallets, shares, INTERVAL, 59);
    }

    // =========================================================================
    // Test 13 — createVault with _pendingWindow=30*86400+1 reverts PendingWindowTooLong
    // =========================================================================
    function test_createVault_pendingWindowTooLong_reverts() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        uint256 tooLong = 30 * 86400 + 1;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.PendingWindowTooLong.selector);
        aVault.createVault(wallets, shares, INTERVAL, tooLong);
    }

    // =========================================================================
    // Test 14 — createVault with _pendingWindow=60 succeeds (MIN_PENDING_WINDOW)
    // =========================================================================
    function test_createVault_pendingWindowAtMinBound_succeeds() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, 60);

        (,,, uint256 storedPWindow,,, bool active) = _vaultFields(vid);
        assertEq(storedPWindow, 60);
        assertTrue(active);
    }

    // =========================================================================
    // Test 15 — createVault with _pendingWindow=30*86400 succeeds (MAX_PENDING_WINDOW)
    // =========================================================================
    function test_createVault_pendingWindowAtMaxBound_succeeds() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        uint256 maxWindow = 30 * 86400;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, maxWindow);

        (,,, uint256 storedPWindow,,, bool active) = _vaultFields(vid);
        assertEq(storedPWindow, maxWindow);
        assertTrue(active);
    }

    // =========================================================================
    // Test 16 — finalizeRelease without startRelease reverts NotPending
    // =========================================================================
    function test_finalizeRelease_noPending_reverts() public {
        uint256 vid = _createSimpleVault();

        // Don't call startRelease at all — pendingSince == 0
        vm.expectRevert(AmanahVault.NotPending.selector);
        aVault.finalizeRelease(vid);
    }
}
