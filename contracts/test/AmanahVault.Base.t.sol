// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AmanahVault} from "../AmanahVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock — mint, approve, transfer, transferFrom, balanceOf.
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
        totalSupply   += amount;
        balanceOf[to] += amount;
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
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Invariant handler — deposit/withdraw only (no pending/release ops so the
// handler stays compatible with the stateful balance invariant test).
// ---------------------------------------------------------------------------
contract VaultHandler is Test {
    AmanahVault public vault;
    MockERC20   public usdc;
    uint256     public vaultId;
    address     public owner;
    address     public beneficiary;

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
// Shared base — setUp, actors, constants, helpers.
// No test/fuzz/invariant functions here; category files inherit this.
// ---------------------------------------------------------------------------
abstract contract AmanahVaultTestBase is Test {

    AmanahVault internal aVault;
    MockERC20   internal usdc;

    address internal owner    = makeAddr("owner");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");
    address internal carol    = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant INTERVAL       = 30 days;
    uint256 internal constant PENDING_WINDOW = 300;       // 5 minutes — default for helpers
    uint256 internal constant MINT_AMOUNT    = 1_000_000e6;
    uint256 internal constant DEPOSIT_AMOUNT = 10_000e6;

    // -----------------------------------------------------------------------
    // setUp — runs before EVERY test in every subcontract
    // -----------------------------------------------------------------------
    function setUp() public virtual {
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        aVault = new AmanahVault(address(usdc));
    }

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
        vaultId = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    /// Create a two-beneficiary vault (alice 60 %, bob 40 %).
    function _createTwoBeneficiaryVault() internal returns (uint256 vaultId) {
        address[] memory wallets = new address[](2);
        uint16[]  memory shares  = new uint16[](2);
        wallets[0] = alice; shares[0] = 6_000;
        wallets[1] = bob;   shares[1] = 4_000;
        vm.prank(owner);
        vaultId = aVault.createVault(wallets, shares, INTERVAL, PENDING_WINDOW);
    }

    /// Mint tokens and approve the vault for `who`.
    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(aVault), amount);
    }

    /// Warp past the check-in interval so startRelease is unlocked.
    function _warpPastInterval(uint256 createdAt) internal {
        vm.warp(createdAt + INTERVAL + 1);
    }

    /// Helper: startRelease, then warp past pendingWindow, then finalizeRelease.
    function _fullRelease(uint256 vid) internal {
        // Step 1: warp past check-in interval (called after creation, so lastCheckIn ~ setUp ts)
        (, uint256 lastCheckIn,,,,,) = _vaultFields(vid);
        vm.warp(lastCheckIn + INTERVAL + 1);
        aVault.startRelease(vid);

        // Step 2: warp past pending window and finalize
        (,,, uint256 pWindow, uint256 pSince,,) = _vaultFields(vid);
        vm.warp(pSince + pWindow + 1);
        aVault.finalizeRelease(vid);
    }

    /// Destructure all 7 Vault fields.
    function _vaultFields(uint256 vid) internal view returns (
        address vOwner,
        uint256 lastCheckIn,
        uint256 checkInInterval,
        uint256 pendingWindow,
        uint256 pendingSince_,   // renamed to avoid shadowing
        bool    released,
        bool    active
    ) {
        (vOwner, lastCheckIn, checkInInterval, pendingWindow, pendingSince_, released, active)
            = aVault.vaults(vid);
    }
}
