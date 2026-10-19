// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin Contracts (last updated v5.1.0) (utils/Errors.sol)

library Errors {
    error InsufficientBalance(uint256 balance, uint256 needed);
    error FailedCall();
    error FailedDeployment();
    error MissingPrecompile(address);
}

// OpenZeppelin Contracts (last updated v5.1.0) (utils/introspection/IERC165.sol)

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/IERC20.sol)

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// OpenZeppelin Contracts (last updated v5.1.0) (utils/Address.sol)

library Address {
    error AddressEmptyCode(address target);

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert Errors.InsufficientBalance(address(this).balance, amount);
        }
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert Errors.FailedCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert Errors.InsufficientBalance(address(this).balance, value);
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly ("memory-safe") {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert Errors.FailedCall();
        }
    }
}

// OpenZeppelin Contracts (last updated v5.1.0) (interfaces/IERC1363.sol)

interface IERC1363 is IERC20, IERC165 {
    function transferAndCall(address to, uint256 value) external returns (bool);
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);
    function approveAndCall(address spender, uint256 value) external returns (bool);
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/utils/SafeERC20.sol)

library SafeERC20 {
    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            let success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            if iszero(success) {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
            returnSize := returndatasize()
            returnValue := mload(0)
        }
        if (returnSize == 0 ? address(token).code.length == 0 : returnValue != 1) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        bool success;
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            returnSize := returndatasize()
            returnValue := mload(0)
        }
        return success && (returnSize == 0 ? address(token).code.length > 0 : returnValue == 1);
    }
}

// AmanahVault — multi-tenant dead-man's-switch USDC inheritance vault
// USDC on Arc Testnet + Mainnet: 0x3600000000000000000000000000000000000000
// No admin keys. No upgradeability. No yield, interest, staking, or lending.

contract AmanahVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Beneficiary {
        address wallet;
        uint16 shareBps; // basis points; per-vault sum must equal 10000
    }

    struct Vault {
        address owner;
        uint256 lastCheckIn;
        uint256 checkInInterval;
        bool released;
        bool active;
    }

    error ZeroAddress();
    error ZeroAmount();
    error ZeroInterval();
    error NotOwner();
    error NotActive();
    error AlreadyReleased();
    error TooSoon();
    error InvalidShares();
    error InvalidBeneficiaryCount();
    error ArrayLengthMismatch();
    error NothingToClaim();
    error VaultNotFound();

    IERC20 public immutable usdc;
    uint256 public vaultCount;

    mapping(uint256 => Vault) public vaults;
    mapping(uint256 => Beneficiary[]) public beneficiaries;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => uint256) public vaultBalance;

    event VaultCreated(uint256 indexed vaultId, address indexed owner, uint256 checkInInterval, uint256 beneficiaryCount);
    event Deposited(uint256 indexed vaultId, address indexed sender, uint256 amount);
    event CheckedIn(uint256 indexed vaultId, address indexed owner, uint256 timestamp);
    event Withdrawn(uint256 indexed vaultId, address indexed owner, uint256 amount);
    event BeneficiariesUpdated(uint256 indexed vaultId, address indexed owner, uint256 beneficiaryCount);
    event Released(uint256 indexed vaultId, address indexed caller, uint256 totalDistributed, uint256 beneficiaryCount);
    event Claimed(uint256 indexed vaultId, address indexed beneficiary, uint256 amount);

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    function createVault(
        address[] memory _beneficiaryWallets,
        uint16[] memory _shareBps,
        uint256 _checkInInterval
    ) external returns (uint256 vaultId) {
        if (_checkInInterval == 0) revert ZeroInterval();

        vaultId = ++vaultCount;

        vaults[vaultId] = Vault({
            owner: msg.sender,
            lastCheckIn: block.timestamp,
            checkInInterval: _checkInInterval,
            released: false,
            active: true
        });

        _validateAndSetBeneficiaries(vaultId, _beneficiaryWallets, _shareBps);

        emit VaultCreated(vaultId, msg.sender, _checkInInterval, _beneficiaryWallets.length);
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

        vault.lastCheckIn = block.timestamp;

        emit CheckedIn(vaultId, msg.sender, block.timestamp);
    }

    function withdraw(uint256 vaultId, uint256 amount) external nonReentrant {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.owner) revert NotOwner();
        if (!vault.active) revert NotActive();
        if (vault.released) revert AlreadyReleased();
        if (amount == 0) revert ZeroAmount();

        vaultBalance[vaultId] -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(vaultId, msg.sender, amount);
    }

    function updateBeneficiaries(
        uint256 vaultId,
        address[] memory _wallets,
        uint16[] memory _shareBps
    ) external {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.owner) revert NotOwner();
        if (!vault.active) revert NotActive();
        if (vault.released) revert AlreadyReleased();

        delete beneficiaries[vaultId];
        _validateAndSetBeneficiaries(vaultId, _wallets, _shareBps);

        emit BeneficiariesUpdated(vaultId, msg.sender, _wallets.length);
    }

    function release(uint256 vaultId) external nonReentrant {
        _requireVaultExists(vaultId);

        Vault storage vault = vaults[vaultId];
        if (vault.released) revert AlreadyReleased();
        if (!vault.active) revert NotActive();
        if (block.timestamp < vault.lastCheckIn + vault.checkInInterval) revert TooSoon();

        // Checks-effects-interactions: flip state before any token interaction
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

        // Last beneficiary receives remainder to absorb rounding dust
        uint256 remainder = totalBalance - distributed;
        claimable[vaultId][vaultBeneficiaries[lastIndex].wallet] += remainder;

        emit Released(vaultId, msg.sender, totalBalance, beneficiaryCount);
    }

    function claim(uint256 vaultId) external nonReentrant {
        uint256 amount = claimable[vaultId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        // Checks-effects-interactions: zero storage before transfer
        claimable[vaultId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit Claimed(vaultId, msg.sender, amount);
    }

    function _validateAndSetBeneficiaries(
        uint256 vaultId,
        address[] memory _wallets,
        uint16[] memory _shareBps
    ) internal {
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
