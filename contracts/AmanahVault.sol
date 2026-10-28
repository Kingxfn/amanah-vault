// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AmanahVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Beneficiary {
        address wallet;
        uint16 shareBps;
    }

    struct Vault {
        address owner;
        uint256 lastCheckIn;
        uint256 checkInInterval;
        uint256 pendingWindow;
        uint256 pendingSince;
        bool released;
        bool active;
    }

    error ZeroAddress();
    error ZeroAmount();
    error ZeroInterval();
    error PendingWindowTooShort();
    error PendingWindowTooLong();
    error NotOwner();
    error NotActive();
    error AlreadyReleased();
    error NotOverdue();
    error AlreadyPending();
    error NotPending();
    error PendingWindowNotElapsed();
    error InvalidShares();
    error InvalidBeneficiaryCount();
    error ArrayLengthMismatch();
    error NothingToClaim();
    error VaultNotFound();

    IERC20 public immutable usdc;
    uint256 public vaultCount;
    uint256 public constant MIN_PENDING_WINDOW = 60;
    uint256 public constant MAX_PENDING_WINDOW = 30 * 86400;

    mapping(uint256 => Vault) public vaults;
    mapping(uint256 => Beneficiary[]) public beneficiaries;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => uint256) public vaultBalance;

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        uint256 checkInInterval,
        uint256 pendingWindow,
        uint256 beneficiaryCount
    );
    event Deposited(uint256 indexed vaultId, address indexed sender, uint256 amount);
    event CheckedIn(uint256 indexed vaultId, address indexed owner, uint256 timestamp);
    event Withdrawn(uint256 indexed vaultId, address indexed owner, uint256 amount);
    event BeneficiariesUpdated(uint256 indexed vaultId, address indexed owner, uint256 beneficiaryCount);
    event PendingReleaseStarted(uint256 indexed vaultId, address indexed caller, uint256 pendingSince, uint256 pendingWindow);
    event ReleaseCancelled(uint256 indexed vaultId, address indexed owner);
    event Released(uint256 indexed vaultId, address indexed caller, uint256 totalDistributed, uint256 beneficiaryCount);
    event Claimed(uint256 indexed vaultId, address indexed beneficiary, uint256 amount);

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    function createVault(
        address[] memory _beneficiaryWallets,
        uint16[] memory _shareBps,
        uint256 _checkInInterval,
        uint256 _pendingWindow
    ) external returns (uint256 vaultId) {
        if (_checkInInterval == 0) revert ZeroInterval();
        if (_pendingWindow < MIN_PENDING_WINDOW) revert PendingWindowTooShort();
        if (_pendingWindow > MAX_PENDING_WINDOW) revert PendingWindowTooLong();

        vaultId = ++vaultCount;

        vaults[vaultId] = Vault({
            owner: msg.sender,
            lastCheckIn: block.timestamp,
            checkInInterval: _checkInInterval,
            pendingWindow: _pendingWindow,
            pendingSince: 0,
            released: false,
            active: true
        });

        _validateAndSetBeneficiaries(vaultId, _beneficiaryWallets, _shareBps);

        emit VaultCreated(vaultId, msg.sender, _checkInInterval, _pendingWindow, _beneficiaryWallets.length);
    }

    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (vault.released) revert AlreadyReleased();
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        vaultBalance[vaultId] += received;

        emit Deposited(vaultId, msg.sender, received);
    }

    function checkIn(uint256 vaultId) external {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.owner) revert NotOwner();
        if (!vault.active) revert NotActive();

        // Cancel a pending release only while the pending window is still open.
        // Once the window has elapsed the owner can no longer race a finalizeRelease.
        if (vault.pendingSince != 0) {
            if (block.timestamp >= vault.pendingSince + vault.pendingWindow) revert PendingWindowNotElapsed();
            vault.pendingSince = 0;
            emit ReleaseCancelled(vaultId, msg.sender);
        }

        vault.lastCheckIn = block.timestamp;

        emit CheckedIn(vaultId, msg.sender, block.timestamp);
    }

    function withdraw(uint256 vaultId, uint256 amount) external nonReentrant {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.owner) revert NotOwner();
        if (!vault.active) revert NotActive();
        if (vault.released) revert AlreadyReleased();
        // Lock owner mutations once the pending window has expired.
        if (vault.pendingSince != 0 && block.timestamp >= vault.pendingSince + vault.pendingWindow)
            revert PendingWindowNotElapsed();
        if (amount == 0) revert ZeroAmount();

        vaultBalance[vaultId] -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(vaultId, msg.sender, amount);
    }

    function updateBeneficiaries(uint256 vaultId, address[] memory _wallets, uint16[] memory _shareBps) external {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.owner) revert NotOwner();
        if (!vault.active) revert NotActive();
        if (vault.released) revert AlreadyReleased();
        // Lock owner mutations once the pending window has expired.
        if (vault.pendingSince != 0 && block.timestamp >= vault.pendingSince + vault.pendingWindow)
            revert PendingWindowNotElapsed();

        delete beneficiaries[vaultId];
        _validateAndSetBeneficiaries(vaultId, _wallets, _shareBps);

        emit BeneficiariesUpdated(vaultId, msg.sender, _wallets.length);
    }

    function startRelease(uint256 vaultId) external {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (vault.released) revert AlreadyReleased();
        if (!vault.active) revert NotActive();
        if (block.timestamp < vault.lastCheckIn + vault.checkInInterval) revert NotOverdue();
        if (vault.pendingSince != 0) revert AlreadyPending();

        vault.pendingSince = block.timestamp;

        emit PendingReleaseStarted(vaultId, msg.sender, vault.pendingSince, vault.pendingWindow);
    }

    function finalizeRelease(uint256 vaultId) external nonReentrant {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (vault.released) revert AlreadyReleased();
        if (!vault.active) revert NotActive();
        if (vault.pendingSince == 0) revert NotPending();
        if (block.timestamp < vault.pendingSince + vault.pendingWindow) revert PendingWindowNotElapsed();

        vault.released = true;
        vault.active = false;

        uint256 totalBalance = vaultBalance[vaultId];
        vaultBalance[vaultId] = 0;

        Beneficiary[] storage vaultBeneficiaries = beneficiaries[vaultId];
        uint256 beneficiaryCount = vaultBeneficiaries.length;

        if (totalBalance < 1) {
            emit Released(vaultId, msg.sender, 0, beneficiaryCount);
            return;
        }

        uint256 distributed = 0;
        uint256 lastIndex = beneficiaryCount - 1;

        for (uint256 i = 0; i < lastIndex; i++) {
            uint256 share = (totalBalance * vaultBeneficiaries[i].shareBps) / 10_000;
            distributed += share;
            claimable[vaultId][vaultBeneficiaries[i].wallet] += share;
        }

        uint256 remainder = totalBalance - distributed;
        claimable[vaultId][vaultBeneficiaries[lastIndex].wallet] += remainder;

        emit Released(vaultId, msg.sender, totalBalance, beneficiaryCount);
    }

    function claim(uint256 vaultId) external nonReentrant {
        uint256 amount = claimable[vaultId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[vaultId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit Claimed(vaultId, msg.sender, amount);
    }

    function _validateAndSetBeneficiaries(uint256 vaultId, address[] memory _wallets, uint16[] memory _shareBps) internal {
        if (_wallets.length != _shareBps.length) revert ArrayLengthMismatch();
        if (_wallets.length == 0 || _wallets.length > 10) revert InvalidBeneficiaryCount();

        uint256 totalShareBps = 0;

        for (uint256 i = 0; i < _wallets.length; i++) {
            address wallet = _wallets[i];
            if (wallet == address(0)) revert ZeroAddress();

            totalShareBps += _shareBps[i];
            beneficiaries[vaultId].push(Beneficiary({wallet: wallet, shareBps: _shareBps[i]}));
        }

        if (totalShareBps != 10_000) revert InvalidShares();
    }

    function _requireVaultExists(uint256 vaultId) private view {
        if (vaultId == 0 || vaultId > vaultCount) revert VaultNotFound();
    }
}
