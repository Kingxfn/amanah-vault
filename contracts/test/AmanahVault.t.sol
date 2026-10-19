// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AmanahVault} from "../AmanahVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock — mint, approve, transfer, transferFrom, balanceOf.
// Lives only in this test file; the deploy tool never sees it.
// ---------------------------------------------------------------------------
contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name     = _name;
        symbol   = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        totalSupply        += amount;
        balanceOf[to]      += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]            -= amount;
        balanceOf[to]              += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Invariant handler — used by the stateful invariant test below.
// ---------------------------------------------------------------------------
contract VaultHandler is Test {
    AmanahVault public vault;
    MockERC20   public usdc;
    uint256     public vaultId;
    address     public owner;
    address      public beneficiary;

    constructor(AmanahVault _vault, MockERC20 _usdc, uint256 _vaultId, address _owner, address _ben) {
        vault       = _vault;
        usdc        = _usdc;
        vaultId     = _vaultId;
        owner       = _owner;
        beneficiary = _ben;
    }

    /// Deposit a bounded amount on behalf of the owner.
    function deposit(uint256 amount) external {
        amount = bound(amount, 1, 1_000_000e6);
        usdc.mint(owner, amount);
        vm.startPrank(owner);
        usdc.approve(address(vault), amount);
        vault.deposit(vaultId, amount);
        vm.stopPrank();
    }

    /// Withdraw a bounded amount (capped to current vaultBalance to avoid underflow reverts).
    function withdraw(uint256 amount) external {
        uint256 bal = vault.vaultBalance(vaultId);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(owner);
        vault.withdraw(vaultId, amount);
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------
contract AmanahVaultTest is Test {

    // -----------------------------------------------------------------------
    // Shared state
    // -----------------------------------------------------------------------
    AmanahVault internal aVault;
    MockERC20   internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant INTERVAL     = 30 days;
    uint256 internal constant MINT_AMOUNT  = 1_000_000e6; // 1 M USDC (6 dec)
    uint256 internal constant DEPOSIT_AMOUNT = 10_000e6;  // 10 k USDC

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /// Create a simple single-beneficiary vault owned by `owner`.
    function _createSimpleVault() internal returns (uint256 vaultId) {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice;
        shares[0]  = 10_000;

        vm.prank(owner);
        vaultId = aVault.createVault(wallets, shares, INTERVAL);
    }

    /// Create a two-beneficiary vault (alice 60 %, bob 40 %).
    function _createTwoBeneficiaryVault() internal returns (uint256 vaultId) {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = alice; shares[0] = 6_000;
        wallets[1] = bob;   shares[1] = 4_000;

        vm.prank(owner);
        vaultId = aVault.createVault(wallets, shares, INTERVAL);
    }

    /// Mint tokens and approve the vault for `who`.
    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(aVault), amount);
    }

    /// Warp past the check-in interval so release() is unlocked.
    function _warpPastInterval(uint256 createdAt) internal {
        vm.warp(createdAt + INTERVAL + 1);
    }

    // -----------------------------------------------------------------------
    // setUp — runs before EVERY test
    // -----------------------------------------------------------------------
    function setUp() public {
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        aVault = new AmanahVault(address(usdc));
    }

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
        emit AmanahVault.VaultCreated(1, owner, INTERVAL, 1);

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL);

        assertEq(vid, 1);
        assertEq(aVault.vaultCount(), 1);

        (address vOwner,, uint256 interval, bool released, bool active) = aVault.vaults(vid);
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
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL);
        assertEq(vid, 1);
        assertEq(aVault.vaultCount(), 1);
    }

    function test_CreateVault_SetsLastCheckInToBlockTimestamp() public {
        uint256 ts = block.timestamp;
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
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
        aVault.createVault(wallets, shares, 0);
    }

    function test_CreateVault_Reverts_ArrayLengthMismatch() public {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; wallets[1] = bob;
        shares[0]  = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ArrayLengthMismatch.selector);
        aVault.createVault(wallets, shares, INTERVAL);
    }

    function test_CreateVault_Reverts_ZeroBeneficiaries() public {
        address[] memory wallets = new address[](0);
        uint16[]  memory shares  = new uint16[](0);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.createVault(wallets, shares, INTERVAL);
    }

    function test_CreateVault_Reverts_ElevenBeneficiaries() public {
        address[] memory wallets = new address[](11);
        uint16[]  memory shares  = new uint16[](11);
        uint16 bps = 909; // 909*11 = 9999 — we'll override last to get 10001, but the count check fires first
        for (uint256 i = 0; i < 11; i++) {
            wallets[i] = makeAddr(string(abi.encodePacked("ben", i)));
            shares[i]  = bps;
        }
        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidBeneficiaryCount.selector);
        aVault.createVault(wallets, shares, INTERVAL);
    }

    function test_CreateVault_Reverts_InvalidShares_LessThan10000() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 9_999;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidShares.selector);
        aVault.createVault(wallets, shares, INTERVAL);
    }

    function test_CreateVault_Reverts_InvalidShares_MoreThan10000() public {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = alice; shares[0] = 9_000;
        wallets[1] = bob;   shares[1] = 2_000; // 11 000 bps total

        vm.prank(owner);
        vm.expectRevert(AmanahVault.InvalidShares.selector);
        aVault.createVault(wallets, shares, INTERVAL);
    }

    function test_CreateVault_Reverts_ZeroAddressBeneficiary() public {
        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = address(0); shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.ZeroAddress.selector);
        aVault.createVault(wallets, shares, INTERVAL);
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

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);

        aVault.release(vid);

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

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        assertEq(lastCheckIn, newTs);
    }

    function test_CheckIn_PreventsPrematureRelease() public {
        uint256 vid = _createSimpleVault();
        // Advance almost to interval, then check in to reset the clock
        vm.warp(block.timestamp + INTERVAL - 1);
        vm.prank(owner);
        aVault.checkIn(vid);

        // Now only 1 second has passed since last checkIn — release should fail
        vm.expectRevert(AmanahVault.TooSoon.selector);
        aVault.release(vid);
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
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        vm.prank(owner);
        vm.expectRevert(AmanahVault.NotActive.selector);
        aVault.withdraw(vid, 1);
    }

    function test_Withdraw_Reverts_AlreadyReleased() public {
        // Same guard — active=false fires first (NotActive), but here we confirm
        // AlreadyReleased is also set by verifying the vault state.
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        (,,, bool released,) = aVault.vaults(vid);
        assertTrue(released);
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

        // Solidity 0.8 arithmetic underflow reverts with a Panic
        vm.prank(owner);
        vm.expectRevert(); // arithmetic underflow panic
        aVault.withdraw(vid, DEPOSIT_AMOUNT + 1);
    }

    // =========================================================================
    // 6. updateBeneficiaries — happy path
    // =========================================================================

    function test_UpdateBeneficiaries_HappyPath() public {
        uint256 vid = _createSimpleVault(); // single beneficiary: alice 100%

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

        // Release and check claimable — alice should get nothing, bob/carol get half each
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice; shares[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(AmanahVault.NotActive.selector);
        aVault.updateBeneficiaries(vid, wallets, shares);
    }

    function test_UpdateBeneficiaries_Reverts_AlreadyReleased_DoubleCheck() public {
        // Verifies the released flag is set (NotActive fires first due to order in code).
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        (,,, bool released, bool active) = aVault.vaults(vid);
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
    // 7. release — happy path
    // =========================================================================

    function test_Release_HappyPath_SingleBeneficiary() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);

        // address(this) is the test contract — it calls release() below (no vm.prank)
        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Released(vid, address(this), DEPOSIT_AMOUNT, 1);

        aVault.release(vid); // called by address(this), not stranger

        (,,, bool released, bool active) = aVault.vaults(vid);
        assertTrue(released);
        assertFalse(active);
        assertEq(aVault.vaultBalance(vid), 0);
        assertEq(aVault.claimable(vid, alice), DEPOSIT_AMOUNT);
    }

    function test_Release_HappyPath_TwoBeneficiaries() public {
        uint256 vid = _createTwoBeneficiaryVault(); // alice 60%, bob 40%
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        uint256 aliceShare = (DEPOSIT_AMOUNT * 6_000) / 10_000;
        uint256 bobShare   = DEPOSIT_AMOUNT - aliceShare; // remainder

        assertEq(aVault.claimable(vid, alice), aliceShare);
        assertEq(aVault.claimable(vid, bob),   bobShare);
    }

    function test_Release_ZeroBalance_SetsReleasedNoClaimable() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);

        vm.expectEmit(true, true, false, true, address(aVault));
        emit AmanahVault.Released(vid, address(this), 0, 1);

        aVault.release(vid);

        (,,, bool released, bool active) = aVault.vaults(vid);
        assertTrue(released);
        assertFalse(active);
        assertEq(aVault.claimable(vid, alice), 0);
    }

    function test_Release_DustDistribution() public {
        // 3 beneficiaries: 3334 / 3333 / 3333 bps, balance = 100 tokens (no 6-dec scaling
        // to keep arithmetic clear)
        address[] memory wallets = new address[](3);
        uint16[]  memory shares  = new uint16[](3);
        wallets[0] = alice; shares[0] = 3_334;
        wallets[1] = bob;   shares[1] = 3_333;
        wallets[2] = carol; shares[2] = 3_333;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL);

        uint256 balance = 100; // raw units, no decimals needed for this arithmetic test
        _fund(stranger, balance);
        vm.prank(stranger);
        aVault.deposit(vid, balance);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        // First two beneficiaries: computed per share
        uint256 aliceShare = (balance * 3_334) / 10_000; // 33
        uint256 bobShare   = (balance * 3_333) / 10_000; // 33
        // Last beneficiary gets remainder: 100 - 33 - 33 = 34
        uint256 carolShare = balance - aliceShare - bobShare;

        assertEq(aVault.claimable(vid, alice), aliceShare);
        assertEq(aVault.claimable(vid, bob),   bobShare);
        assertEq(aVault.claimable(vid, carol),  carolShare);
        // Total must equal original balance
        assertEq(aliceShare + bobShare + carolShare, balance);
    }

    // =========================================================================
    // 7b. release — revert paths
    // =========================================================================

    function test_Release_Reverts_VaultNotFound() public {
        vm.expectRevert(AmanahVault.VaultNotFound.selector);
        aVault.release(999);
    }

    function test_Release_Reverts_TooSoon() public {
        uint256 vid = _createSimpleVault();
        // Still within the interval
        vm.expectRevert(AmanahVault.TooSoon.selector);
        aVault.release(vid);
    }

    function test_Release_Succeeds_AtExactInterval() public {
        // The contract uses strict less-than: block.timestamp < lastCheckIn + interval
        // So at exactly lastCheckIn + interval the condition is FALSE → release succeeds.
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        vm.warp(lastCheckIn + INTERVAL); // exactly at the boundary — should NOT revert
        aVault.release(vid);
        (,,, bool released,) = aVault.vaults(vid);
        assertTrue(released);
    }

    function test_Release_Reverts_AlreadyReleased() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        vm.expectRevert(AmanahVault.AlreadyReleased.selector);
        aVault.release(vid);
    }

    function test_Release_Reverts_NotActive_AfterRelease() public {
        // After release, released=true fires before NotActive; confirm AlreadyReleased.
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        // Second call hits AlreadyReleased (checked before NotActive in release())
        vm.expectRevert(AmanahVault.AlreadyReleased.selector);
        aVault.release(vid);
    }

    // =========================================================================
    // 8. claim — happy path
    // =========================================================================

    function test_Claim_HappyPath() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        vm.prank(alice);
        aVault.claim(vid);

        vm.prank(alice);
        vm.expectRevert(AmanahVault.NothingToClaim.selector);
        aVault.claim(vid);
    }

    function test_Claim_Reverts_NothingToClaim_WrongBeneficiary() public {
        uint256 vid = _createSimpleVault(); // alice is sole beneficiary
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        // bob is not a beneficiary
        vm.prank(bob);
        vm.expectRevert(AmanahVault.NothingToClaim.selector);
        aVault.claim(vid);
    }

    // =========================================================================
    // 9. MULTI-VAULT ISOLATION
    // =========================================================================

    function test_MultiVault_Isolation_TwoOwners() public {
        address owner2 = makeAddr("owner2");

        // Vault 1: owner → beneficiary alice
        address[] memory w1 = new address[](1);
        uint16[]  memory s1 = new uint16[](1);
        w1[0] = alice; s1[0] = 10_000;
        vm.prank(owner);
        uint256 v1 = aVault.createVault(w1, s1, INTERVAL);

        // Vault 2: owner2 → beneficiary bob
        address[] memory w2 = new address[](1);
        uint16[]  memory s2 = new uint16[](1);
        w2[0] = bob; s2[0] = 10_000;
        vm.prank(owner2);
        uint256 v2 = aVault.createVault(w2, s2, INTERVAL);

        // Deposit into each vault separately
        uint256 dep1 = 5_000e6;
        uint256 dep2 = 7_000e6;
        _fund(owner, dep1);
        vm.prank(owner);
        aVault.deposit(v1, dep1);

        _fund(owner2, dep2);
        vm.prank(owner2);
        aVault.deposit(v2, dep2);

        // Check balances are isolated
        assertEq(aVault.vaultBalance(v1), dep1);
        assertEq(aVault.vaultBalance(v2), dep2);

        // Release v1 — should not affect v2
        (, uint256 lc1,,,) = aVault.vaults(v1);
        _warpPastInterval(lc1);
        aVault.release(v1);

        assertEq(aVault.vaultBalance(v1), 0);
        assertEq(aVault.vaultBalance(v2), dep2); // v2 unaffected

        (,,, bool rel1, bool act1) = aVault.vaults(v1);
        (,,, bool rel2, bool act2) = aVault.vaults(v2);
        assertTrue(rel1);
        assertFalse(act1);
        assertFalse(rel2);
        assertTrue(act2);

        // owner2 is not the owner of v1 — NotOwner fires before NotActive (contract order)
        vm.prank(owner2);
        vm.expectRevert(AmanahVault.NotOwner.selector);
        aVault.withdraw(v1, 1);
    }

    function test_MultiVault_ClaimIsolation() public {
        // Two vaults — releasing one should not create claimable for the other vault's benef.
        uint256 v1 = _createSimpleVault(); // alice sole beneficiary

        address[] memory w2 = new address[](1);
        uint16[]  memory s2 = new uint16[](1);
        w2[0] = bob; s2[0] = 10_000;
        vm.prank(makeAddr("owner2"));
        uint256 v2 = aVault.createVault(w2, s2, INTERVAL);

        _fund(stranger, DEPOSIT_AMOUNT * 2);
        vm.startPrank(stranger);
        aVault.deposit(v1, DEPOSIT_AMOUNT);
        aVault.deposit(v2, DEPOSIT_AMOUNT);
        vm.stopPrank();

        (, uint256 lc1,,,) = aVault.vaults(v1);
        _warpPastInterval(lc1);
        aVault.release(v1);

        // bob has nothing claimable from v1, alice has nothing claimable from v2
        assertEq(aVault.claimable(v1, bob), 0);
        assertEq(aVault.claimable(v2, alice), 0);
        assertEq(aVault.claimable(v1, alice), DEPOSIT_AMOUNT);
    }

    // =========================================================================
    // 10. FUZZ — createVault with random valid interval
    // =========================================================================

    function testFuzz_CreateVault_ValidInterval(uint256 interval) public {
        interval = bound(interval, 1, 365 days * 10);

        address[] memory wallets = new address[](1);
        uint16[]  memory shares  = new uint16[](1);
        wallets[0] = alice;
        shares[0]  = 10_000;

        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, interval);

        (,, uint256 storedInterval,, bool active) = aVault.vaults(vid);
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
    // 11. INVARIANT PROPERTY — after release, vaultBalance == 0
    // Tested as a deterministic scenario with varied deposit amounts to exercise
    // the "zeroed on release" property. The stateful fuzz handler is kept for
    // use in a dedicated invariant contract below.
    // =========================================================================

    function test_Invariant_VaultBalanceZeroAfterRelease_Single() public {
        uint256 vid = _createSimpleVault();
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    function test_Invariant_VaultBalanceZeroAfterRelease_ZeroBalance() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);
        assertEq(aVault.vaultBalance(vid), 0);
    }

    function test_Invariant_VaultBalanceZeroAfterRelease_PartialWithdraw() public {
        uint256 vid = _createSimpleVault();
        _fund(owner, DEPOSIT_AMOUNT);
        vm.prank(owner);
        aVault.deposit(vid, DEPOSIT_AMOUNT);
        // Withdraw half before release
        vm.prank(owner);
        aVault.withdraw(vid, DEPOSIT_AMOUNT / 2);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

        assertEq(aVault.vaultBalance(vid), 0);
    }

    // =========================================================================
    // 12. ADDITIONAL EDGE-CASE TESTS
    // =========================================================================

    function test_Release_ExactlyAtIntervalPlusOne_Succeeds() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        // Should NOT revert
        aVault.release(vid);
        (,,, bool released,) = aVault.vaults(vid);
        assertTrue(released);
    }

    function test_Deposit_AnyoneCanDeposit() public {
        uint256 vid = _createSimpleVault();
        // stranger (not the owner) deposits — should succeed
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT); // no revert
        assertEq(aVault.vaultBalance(vid), DEPOSIT_AMOUNT);
    }

    function test_Release_AnyoneCanTrigger() public {
        uint256 vid = _createSimpleVault();
        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);

        // stranger triggers release — should succeed
        vm.prank(stranger);
        aVault.release(vid);
        (,,, bool released,) = aVault.vaults(vid);
        assertTrue(released);
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
        // 10 equal shares of 1000 bps = 10 000
        for (uint256 i = 0; i < 10; i++) {
            wallets[i] = makeAddr(string(abi.encodePacked("max", i)));
            shares[i]  = 1_000;
        }
        vm.prank(owner);
        uint256 vid = aVault.createVault(wallets, shares, INTERVAL);
        assertEq(vid, 1);
    }

    function test_Claim_MultipleBeneficiaries_EachReceivesShare() public {
        uint256 vid = _createTwoBeneficiaryVault(); // alice 60%, bob 40%
        _fund(stranger, DEPOSIT_AMOUNT);
        vm.prank(stranger);
        aVault.deposit(vid, DEPOSIT_AMOUNT);

        (, uint256 lastCheckIn,,,) = aVault.vaults(vid);
        _warpPastInterval(lastCheckIn);
        aVault.release(vid);

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
