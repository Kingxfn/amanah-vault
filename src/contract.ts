/**
 * AmanahVault contract config — v2 with cancellable pending-release window.
 * USDC: 0x3600000000000000000000000000000000000000 (Arc Testnet + Mainnet)
 * Deployed: see AGENTS.md
 */

export const AMANA_VAULT_ADDRESS =
  (import.meta.env.VITE_VAULT_ADDRESS as `0x${string}` | undefined) ?? '0x0000000000000000000000000000000000000000'

export const AMANA_VAULT_ABI = [
  // constructor
  { type: 'constructor', inputs: [{ name: '_usdc', type: 'address' }], stateMutability: 'nonpayable' },

  // errors
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'ZeroInterval', inputs: [] },
  { type: 'error', name: 'NotOwner', inputs: [] },
  { type: 'error', name: 'NotActive', inputs: [] },
  { type: 'error', name: 'AlreadyReleased', inputs: [] },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidBeneficiaryCount', inputs: [] },
  { type: 'error', name: 'ArrayLengthMismatch', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'VaultNotFound', inputs: [] },
  // pending-release errors
  { type: 'error', name: 'PendingWindowTooShort', inputs: [] },
  { type: 'error', name: 'PendingWindowTooLong', inputs: [] },
  { type: 'error', name: 'NotOverdue', inputs: [] },
  { type: 'error', name: 'AlreadyPending', inputs: [] },
  { type: 'error', name: 'NotPending', inputs: [] },
  { type: 'error', name: 'PendingWindowNotElapsed', inputs: [] },

  // events
  {
    type: 'event', name: 'VaultCreated',
    inputs: [
      { name: 'vaultId',          type: 'uint256', indexed: true },
      { name: 'owner',            type: 'address', indexed: true },
      { name: 'checkInInterval',  type: 'uint256', indexed: false },
      { name: 'pendingWindow',    type: 'uint256', indexed: false },
      { name: 'beneficiaryCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Deposited',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'sender',  type: 'address', indexed: true },
      { name: 'amount',  type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'CheckedIn',
    inputs: [
      { name: 'vaultId',   type: 'uint256', indexed: true },
      { name: 'owner',     type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Withdrawn',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'owner',   type: 'address', indexed: true },
      { name: 'amount',  type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'BeneficiariesUpdated',
    inputs: [
      { name: 'vaultId',          type: 'uint256', indexed: true },
      { name: 'owner',            type: 'address', indexed: true },
      { name: 'beneficiaryCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'PendingReleaseStarted',
    inputs: [
      { name: 'vaultId',       type: 'uint256', indexed: true },
      { name: 'caller',        type: 'address', indexed: true },
      { name: 'pendingSince',  type: 'uint256', indexed: false },
      { name: 'pendingWindow', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ReleaseCancelled',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'owner',   type: 'address', indexed: true },
    ],
  },
  {
    type: 'event', name: 'Released',
    inputs: [
      { name: 'vaultId',           type: 'uint256', indexed: true },
      { name: 'caller',            type: 'address', indexed: true },
      { name: 'totalDistributed',  type: 'uint256', indexed: false },
      { name: 'beneficiaryCount',  type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Claimed',
    inputs: [
      { name: 'vaultId',     type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'amount',      type: 'uint256', indexed: false },
    ],
  },

  // reads — immutables / counters
  {
    type: 'function', name: 'usdc', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'address' }],
  },
  {
    type: 'function', name: 'vaultCount', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'MIN_PENDING_WINDOW', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'MAX_PENDING_WINDOW', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  // reads — vault struct (7 fields: owner, lastCheckIn, checkInInterval, pendingWindow, pendingSince, released, active)
  {
    type: 'function', name: 'vaults', stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [
      { name: 'owner',            type: 'address' },
      { name: 'lastCheckIn',      type: 'uint256' },
      { name: 'checkInInterval',  type: 'uint256' },
      { name: 'pendingWindow',    type: 'uint256' },
      { name: 'pendingSince',     type: 'uint256' },
      { name: 'released',         type: 'bool' },
      { name: 'active',           type: 'bool' },
    ],
  },
  {
    type: 'function', name: 'vaultBalance', stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'beneficiaries', stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }, { name: 'index', type: 'uint256' }],
    outputs: [{ name: 'wallet', type: 'address' }, { name: 'shareBps', type: 'uint16' }],
  },
  {
    type: 'function', name: 'claimable', stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }, { name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },

  // writes
  {
    type: 'function', name: 'createVault', stateMutability: 'nonpayable',
    inputs: [
      { name: '_beneficiaryWallets', type: 'address[]' },
      { name: '_shareBps',           type: 'uint16[]' },
      { name: '_checkInInterval',    type: 'uint256' },
      { name: '_pendingWindow',      type: 'uint256' },
    ],
    outputs: [{ name: 'vaultId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'deposit', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'checkIn', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'updateBeneficiaries', stateMutability: 'nonpayable',
    inputs: [
      { name: 'vaultId',   type: 'uint256' },
      { name: '_wallets',  type: 'address[]' },
      { name: '_shareBps', type: 'uint16[]' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'startRelease', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'finalizeRelease', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'claim', stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
  },
] as const
