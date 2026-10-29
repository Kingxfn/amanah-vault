// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AmanahVaultTestBase} from "./AmanahVault.Base.t.sol";
import {AmanahVault} from "../AmanahVault.sol";

// ===========================================================================
// All pre-existing tests updated for the new 4-arg createVault, 7-field Vault
// struct, and the startRelease/finalizeRelease two-step instead of release().
// ===========================================================================
contract AmanahVaultExistingTest is AmanahVaultTestBase {

    // =========================================================================
    // 1. CONSTRUCTOR
    // =========================================================================

    function test_Constructor_SetsUSDC() public view {
        assertEq(address(aVault.usdc()), address(usdc));
    }

    function test_Constructor_VaultCountZero() public view {
        assertEq(aVault.vaultCount(), 0);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(AmanahVault.ZeroAddress.selector);
        new AmanahVault(address(0));
    }

    // =========================================================================
    // 2. createVault — happy path
    // =========================================================================

    function test_CreateVault_HappyPath_SingleBeneficiary() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice;
        shares[0]  = 10_000;

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.VaultCreated(1, owner, INTERVAL, PENDING_WINDOW, 1);

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);

        assertEq(vid, 1);
        assertEq(aVault.vaultCount(), 1);

        (address vOwner,, uint256 interval,,, bool released, bool active) = _vaultFields(vid);
        assertEq(vOwner, owner);
        assertEq(interval, INTERVAL);
        assertFalse(released);
        assertTrue(active);
    }

    function test_CreateVault_HappyPath_MultipleBeneficiaries() public {
        address[] memory wallets = new address[](3);
        uint16[]  memory shares  = new uint16[](3);
        wallets[0] = alice; shares[0] = 5_000;
        wallets[1] = bob;   shares[1] = 3_000;
        wallets[2] = carol; shares[2] = 2_000;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
        assertEq(vid, 1);
        assertEq(aVault.vaultCount(), 1);
    }

    function test_CreateVault_SetsLastCheckInToBlockTimestamp() public {
        uint256 ts = block.timestamp;
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        assertEq(lastCheckIn, ts);
    }

    function test_CreateVault_IncrementingIds() public {
        uint256 v1 = _createSimpleVault();
        uint256 v2 = _createSimpleVault();
        assertEq(v1, 1);
        assertEq(v2, 2);
        assertEq(aVault.vaultCount(), 2);
    }

    // =========================================================================
    // 2b. createVault — revert paths
    // =========================================================================

    function test_CreateVault_Reverts_ZeroInterval() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ZeroInterval.selector);
        aVault.createVault(wallets, shares, 0, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_ArrayLengthMismatch() public {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; wallets[1] = bob;
        shares[0]  = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ArrayLengthMismatch.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_ZeroBeneficiaries() public {
        address[] memory wallets = new address[](0);
        uint16[]  memory shares  = new uint16[](0);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_ElevenBeneficiaries() public {
        address[] memory wallets = new address[](11);
        uint16[]  memory shares  = new uint16[](11);
        for (uint256 i = 0; i < 11; i++) {
            wallets[i] = makeAddr(string(abi.encodePacked("ben", i)));
            shares[i]  = 909;
        }
        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_InvalidShares_LessThan10000() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 9_999;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidShares.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_InvalidShares_MoreThan10000() public {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = alice; shares[0] = 9_000;
        wallets[1] = bob;   shares[1] = 2_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidShares.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    function test_CreateVault_Reverts_ZeroAddressBeneficiary() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = address(0); shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ZeroAddress.selector);
        aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    // =========================================================================
    // 3. deposit — happy path
    // =========================================================================

    function test_Deposit_HappyPath() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Deposited(vid, stranger, DEPOSIT_AMOUNT);

        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT);
    }

    function test_Deposit_AccumulatesMultipleDeposits() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT * 3);
        vm.startPrank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT * 3);
    }

    function test_Deposit_ContractBalanceIncreasesCorrectly() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);

        uint256 before = usdc.balanceOf(address(aVault));
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        assertEq(usdc.balanceOf(address(aVault)), before + DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // 3b. deposit — revert paths
    // =========================================================================

    function test_Deposit_Reverts_VaultNotFound() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.deposit(999, DEPOSIT_AMOUNT);
    }

    function test_Deposit_Reverts_VaultId_Zero() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.deposit(0, DEPOSIT_AMOUNT);
    }

    function test_Deposit_Reverts_ZeroAmount() public {
        uint256 vid = _createSimpleVault();
        vm.expectRevert(AmanahVault.ZeroAmount.selector);
        aVault.deposit(vid, 0);
    }

    function test_Deposit_Reverts_AlreadyReleased() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        vm.expectRevert(AmanahVault.AlreadyReleased.selector);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // 4. checkIn — happy path
    // =========================================================================

    function test_CheckIn_HappyPath_UpdatesTimestamp() public {
        uint256 vid = _createSimpleVault();
        vm.warp(block.timestamp + 1 days);
        uint256 newTs = block.timestamp;

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.CheckedIn(vid, owner, newTs);

        vm.prank(owner);
        aVault.checkIn(vid);

        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        assertEq(lastCheckIn, newTs);
    }

    function test_CheckIn_PreventsPrematureRelease() public {
        uint256 vid = _createSimpleVault();
        // Advance almost to interval, then check in to reset the clock
        vm.warp(block.timestamp + INTERVAL - 1);
        vm.prank(owner);
        aVault.checkIn(vid);

        // Only 1 second since last checkIn — startRelease should fail
        vm.expectRevert(AmanahVault.NotOverdue.selector);
        aVault.startRelease(vid);
    }

    // =========================================================================
    // 4b. checkIn — revert paths
    // =========================================================================

    function test_CheckIn_Reverts_VaultNotFound() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.checkIn(999);
    }

    function test_CheckIn_Reverts_NotOwner() public {
        uint256 vid = _createSimpleVault();
        vm.prank(stranger);
        vm.expectRevert(AmanahVault.NotOwner.selector);
        aVault.checkIn(vid);
    }

    function test_CheckIn_Reverts_NotActive_AfterRelease() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.NotActive.selector);
        aVault.checkIn(vid);
    }

    // =========================================================================
    // 5. withdraw — happy path
    // =========================================================================

    function test_Withdraw_HappyPath() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Withdrawn(vid, owner, DEPOSIT_AMOUNT / 2);

        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT / 2);

        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT / 2);
        assertEq(usdc.balanceOf(owner), ownerBalBefore + DEPOSIT_AMOUNT / 2);
    }

    function test_Withdraw_Full_ZerosVaultBalance() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    // =========================================================================
    // 5b. withdraw — revert paths
    // =========================================================================

    function test_Withdraw_Reverts_VaultNotFound() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.withdraw(999, 1);
    }

    function test_Withdraw_Reverts_NotOwner() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(AmanahVault.NotOwner.selector);
        aVault.withdraw(vid, DEPOSIT_AMOUNT);
    }

    function test_Withdraw_Reverts_NotActive_AfterRelease() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.NotActive.selector);
        aVault.withdraw(vid, 1);
    }

    function test_Withdraw_Reverts_AlreadyReleased_StateCheck() public {
        // Verifies the released flag is set after a full release cycle.
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        (,,,,, bool released, bool active) = _vaultFields(vid);
        assertTrue(released);
        assertFalse(active);
    }

    function test_Withdraw_Reverts_ZeroAmount() public {
        uint256 vid = _createSimpleVault();
        vm.prank(owner);
        vm.expectRevert(AmanahVault.ZeroAmount.selector);
        aVault.withdraw(vid, 0);
    }

    function test_Withdraw_Reverts_Underflow_MoreThanDeposited() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(); // arithmetic underflow panic
        aVault.withdraw(vid, DEPOSIT_AMOUNT + 1);
    }

    // =========================================================================
    // 6. updateBeneficiaries — happy path
    // =========================================================================

    function test_UpdateBeneficiaries_HappyPath() public {
        uint256 vid = _createSimpleVault();

        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = bob;   shares[0] = 7_000;
        wallets[1] = carol; shares[1] = 3_000;

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.BeneficiariesUpdated(vid, owner, 2);

        vm.prank(owner);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_ReplacesOldList() public {
        uint256 vid = _createSimpleVault();

        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = bob;   shares[0] = 5_000;
        wallets[1] = carol; shares[1] = 5_000;

        vm.prank(owner);
        aVault.updateBeneficiaries(vid, wallets, shares);

        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        _fullRelease(vid);

        assertEq(aVault.claimable(vid, alice), 0);
        assertEq(aVault.claimable(vid, bob),   DEPOSIT_AMOUNT / 2);
        assertEq(aVault.claimable(vid, carol),  DEPOSIT_AMOUNT / 2);
    }

    // =========================================================================
    // 6b. updateBeneficiaries — revert paths
    // =========================================================================

    function test_UpdateBeneficiaries_Reverts_VaultNotFound() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.updateBeneficiaries(999, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_NotOwner() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(stranger);
        vm.expectRevert(AmanahVault.NotOwner.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_NotActive_AfterRelease() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.NotActive.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_AlreadyReleased_DoubleCheck() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        (,,,,,bool released, bool active) = _vaultFields(vid);
        assertTrue(released);
        assertFalse(active);
    }

    function test_UpdateBeneficiaries_Reverts_ArrayLengthMismatch() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; wallets[1] = bob;
        shares[0]  = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ArrayLengthMismatch.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_ZeroBeneficiaries() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](0);
        uint16[]  memory shares  = new uint16[](0);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_TooManyBeneficiaries() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](11);
        uint16[]  memory shares  = new uint16[](11);
        for (uint256 i = 0; i < 11; i++) {
            wallets[i] = makeAddr(string(abi.encodePacked("b", i)));
            shares[i]  = 909;
        }
        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_InvalidShares() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 5_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidShares.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_ZeroAddressBeneficiary() public {
        uint256 vid = _createSimpleVault();
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = address(0); shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ZeroAddress.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    // =========================================================================
    // 7. finalizeRelease — happy path (replaces old `release` tests)
    // =========================================================================

    function test_FinalizeRelease_HappyPath_SingleBeneficiary() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        _warpPastInterval(lastCheckIn);
        aVault.startRelease(vid);

        (,,,uint256 pWindow, uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Released(vid, address(this), DEPOSIT_AMOUNT, 1);

        aVault.finalizeRelease(vid);

        (,,,,,bool released, bool active) = _vaultFields(vid);
        assertTrue(released);
        assertFalse(active);
        assertEq(aVault.vaultBalance(vid), 0);
        assertEq(aVault.claimable(vid, alice), DEPOSIT_AMOUNT);
    }

    function test_FinalizeRelease_HappyPath_TwoBeneficiaries() public {
        uint256 vid = _createTwoBeneficiaryVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        uint256 aliceShare = (DEPOSIT_AMOUNT * 6_000) / 10_000;
        uint256 bobShare   = DEPOSIT_AMOUNT - aliceShare;

        assertEq(aVault.claimable(vid, alice), aliceShare);
        assertEq(aVault.claimable(vid, bob),   bobShare);
    }

    function test_FinalizeRelease_ZeroBalance_SetsReleasedNoClaimable() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        _warpPastInterval(lastCheckIn);
        aVault.startRelease(vid);

        (,,,uint256 pWindow, uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Released(vid, address(this), 0, 1);

        aVault.finalizeRelease(vid);

        (,,,,,bool released, bool active) = _vaultFields(vid);
        assertTrue(released);
        assertFalse(active);
        assertEq(aVault.claimable(vid, alice), 0);
    }

    function test_FinalizeRelease_DustDistribution() public {
        address[] memory wallets = new address[](3);
        uint16[]  memory shares  = new uint16[](3);
        wallets[0] = alice; shares[0] = 3_334;
        wallets[1] = bob;   shares[1] = 3_333;
        wallets[2] = carol; shares[2] = 3_333;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);

        uint256 balance = 100;
        _fund(stranger, balance);
        vm.prank(stranger);
        aVault.deposit(vid, balance);

        _fullRelease(vid);

        uint256 aliceShare = (balance * 3_334) / 10_000;
        uint256 bobShare   = (balance * 3_333) / 10_000;
        uint256 carolShare = balance - aliceShare - bobShare;

        assertEq(aVault.claimable(vid, alice), aliceShare);
        assertEq(aVault.claimable(vid, bob),   bobShare);
        assertEq(aVault.claimable(vid, carol),  carolShare);
        assertEq(aliceShare + bobShare + carolShare, balance);
    }

    // =========================================================================
    // 7b. finalizeRelease — revert paths
    // =========================================================================

    function test_FinalizeRelease_Reverts_VaultNotFound() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.finalizeRelease(999);
    }

    function test_StartRelease_Reverts_TooSoon() public {
        uint256 vid = _createSimpleVault();
        vm.expectRevert(AmanahVault.NotOverdue.selector);
        aVault.startRelease(vid);
    }

    function test_StartRelease_Succeeds_AtExactInterval() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL); // exactly at boundary — should NOT revert
        aVault.startRelease(vid);
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        assertGt(pSince, 0);
    }

    function test_FinalizeRelease_Reverts_AlreadyReleased() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);

        vm.expectRevert(AmanahVault.AlreadyReleased.selector);
        aVault.finalizeRelease(vid);
    }

    // =========================================================================
    // 8. claim — happy path
    // =========================================================================

    function test_Claim_HappyPath() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        uint256 aliceBalBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Claimed(vid, alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        aVault.claim(vid);

        assertEq(usdc.balanceOf(alice), aliceBalBefore + DEPOSIT_AMOUNT);
        assertEq(aVault.claimable(vid, alice), 0);
    }

    function test_Claim_ClearsClaimable() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        vm.prank(alice);
        aVault.claim(vid);

        assertEq(aVault.claimable(vid, alice), 0);
    }

    // =========================================================================
    // 8b. claim — revert paths
    // =========================================================================

    function test_Claim_Reverts_NothingToClaim_NoRelease() public {
        uint256 vid = _createSimpleVault();
        vm.prank(alice);
        vm.expectRevert(AmanahVault.NothingToClaim.selector);
        aVault.claim(vid);
    }

    function test_Claim_Reverts_NothingToClaim_DoubleClaim() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        vm.prank(alice);
        aVault.claim(vid);

        vm.prank(alice);
        vm.expectRevert(AmanahVault.NothingToClaim.selector);
        aVault.claim(vid);
    }

    function test_Claim_Reverts_NothingToClaim_WrongBeneficiary() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        vm.prank(bob);
        vm.expectRevert(AmanahVault.NothingToClaim.selector);
        aVault.claim(vid);
    }

    // =========================================================================
    // 9. MULTI-VAULT ISOLATION
    // =========================================================================

    function test_MultiVault_Isolation_TwoOwners() public {
        address owner2 = makeAddr("owner2");

        address[] memory w1 = new address[](1);
        uint16[]  memory s1 = new uint16[](1);
        w1[0] = alice; s1[0] = 10_000;
        vm.prank(owner);
        uint256 v1 = aVault.createVault(w1, s1, INTERVAL, PENDING_WINDOW);

        address[] memory w2 = new address[](1);
        uint16[]  memory s2 = new uint16[](1);
        w2[0] = bob; s2[0] = 10_000;
        vm.prank(owner2);
        uint256 v2 = aVault.createVault(w2, s2, INTERVAL, PENDING_WINDOW);

        uint256 dep1 = 5_000e6;
        uint256 dep2 = 7_000e6;
        _fund(owner, dep1);
        vm.prank(owner);
        aVault.deposit(v1, dep1);

        _fund(owner2, dep2);
        vm.prank(owner2);
        aVault.deposit(v2, dep2);

        assertEq(aVault.vaultBalance(v1), dep1);
        assertEq(aVault.vaultBalance(v2), dep2);

        // Release v1 — should not affect v2
        _fullRelease(v1);

        assertEq(aVault.vaultBalance(v1), 0);
        assertEq(aVault.vaultBalance(v2), dep2);

        (,,,,,bool rel1, bool act1) = _vaultFields(v1);
        (,,,,,bool rel2, bool act2) = _vaultFields(v2);
        assertTrue(rel1);
        assertFalse(act1);
        assertFalse(rel2);
        assertTrue(act2);

        vm.prank(owner2);
        vm.expectRevert(AmanahVault.NotOwner.selector);
        aVault.withdraw(v1, 1);
    }

    function test_MultiVault_ClaimIsolation() public {
        uint256 v1 = _createSimpleVault();

        address[] memory w2 = new address[](1);
        uint16[]  memory s2 = new uint16[](1);
        w2[0] = bob; s2[0] = 10_000;
        vm.prank(makeAddr("owner2"));
        uint256 v2 = aVault.createVault(w2, s2, INTERVAL, PENDING_WINDOW);

        _fund(stranger, DEPOSIT_AMOUNT * 2);
        vm.startPrank(stranger);
        aVault.deposit(v1, DEPOSIT_AMOUNT);
        aVault.deposit(v2, DEPOSIT_AMOUNT);
        vm.stopPrank();

        _fullRelease(v1);

        assertEq(aVault.claimable(v1, bob), 0);
        assertEq(aVault.claimable(v2, alice), 0);
        assertEq(aVault.claimable(v1, alice), DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // 10. FUZZ
    // =========================================================================

    function testFuzz_CreateVault_ValidInterval(uint256 interval) public {
        interval = bound(interval, 1, 365 days * 10);

        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice;
        shares[0]  = 10_000;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, interval, PENDING_WINDOW);

        (,,uint256 storedInterval,,,,bool active) = _vaultFields(vid);
        assertEq(storedInterval, interval);
        assertTrue(active);
    }

    function testFuzz_Deposit_AddsToVaultBalance(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);
        uint256 vid = _createSimpleVault();
        _fund(stranger, amount);

        vm.prank(stranger);
        aVault.deposit(vid, amount);

        assertEq(aVault.vaultBalance(vid), amount);
    }

    function testFuzz_Withdraw_ReducesVaultBalance(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount  = bound(depositAmount,  1, 1_000_000e6);
        withdrawAmount = bound(withdrawAmount, 1, depositAmount);

        uint256 vid = _createSimpleVault();
        _fund(owner, depositAmount);
        vm.prank(owner);
        aVault.deposit(vid, depositAmount);

        vm.prank(owner);
        aVault.withdraw(vid, withdrawAmount);

        assertEq(aVault.vaultBalance(vid), depositAmount - withdrawAmount);
    }

    // =========================================================================
    // 11. INVARIANT-STYLE: vaultBalance == 0 after finalizeRelease
    // =========================================================================

    function test_Invariant_VaultBalanceZeroAfterRelease_Single() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    function test_Invariant_VaultBalanceZeroAfterRelease_MultipleDeposits() public {
        uint256 vid = _createSimpleVault();
        uint256 dep1 = 3_333e6;
        uint256 dep2 = 6_667e6;

        _fund(stranger, dep1 + dep2);
        vm.startPrank(stranger);
        aVault.deposit(vid, dep1);
        aVault.deposit(vid, dep2);
        vm.stopPrank();

        assertEq(aVault.vaultBalance(vid), dep1 + dep2);

        _fullRelease(vid);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    function test_Invariant_VaultBalanceZeroAfterRelease_ZeroBalance() public {
        uint256 vid = _createSimpleVault();
        _fullRelease(vid);
        assertEq(aVault.vaultBalance(vid), 0);
    }

    function test_Invariant_VaultBalanceZeroAfterRelease_PartialWithdraw() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT / 2);

        _fullRelease(vid);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    // =========================================================================
    // 12. ADDITIONAL EDGE-CASE TESTS
    // =========================================================================

    function test_StartRelease_ExactlyAtIntervalPlusOne_Succeeds() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        assertGt(pSince, 0);
    }

    function test_Deposit_AnyoneCanDeposit() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT);
    }

    function test_StartRelease_AnyoneCanTrigger() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        _warpPastInterval(lastCheckIn);

        vm.prank(stranger);
        aVault.startRelease(vid);
        (,,,,uint256 pSince,,) = _vaultFields(vid);
        assertGt(pSince, 0);
    }

    function test_VaultCount_IncrementsProperly() public {
        assertEq(aVault.vaultCount(), 0);
        _createSimpleVault();
        assertEq(aVault.vaultCount(), 1);
        _createSimpleVault();
        assertEq(aVault.vaultCount(), 2);
    }

    function test_TenBeneficiaries_MaxBoundary() public {
        address[] memory wallets = new address[](10);
        uint16[]  memory shares  = new uint16[](10);
        for (uint256 i = 0; i < 10; i++) {
            wallets[i] = makeAddr(string(abi.encodePacked("max", i)));
            shares[i]  = 1_000;
        }
        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
        assertEq(vid, 1);
    }

    function test_Claim_MultipleBeneficiaries_EachReceivesShare() public {
        uint256 vid = _createTwoBeneficiaryVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        _fullRelease(vid);

        uint256 aliceExpected = (DEPOSIT_AMOUNT * 6_000) / 10_000;
        uint256 bobExpected   = DEPOSIT_AMOUNT - aliceExpected;

        vm.prank(alice);
        aVault.claim(vid);
        vm.prank(bob);
        aVault.claim(vid);

        assertEq(usdc.balanceOf(alice), aliceExpected);
        assertEq(usdc.balanceOf(bob),   bobExpected);
    }

    function test_Withdraw_Owner_ReceivesUSDC() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        uint256 balBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(owner), balBefore + DEPOSIT_AMOUNT);
    }
}
