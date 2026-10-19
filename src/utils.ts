import { buildTxExplorerUrl, buildAddressExplorerUrl, requireChain } from '@/onchain-facts'
import { arc } from 'viem/chains'

/**
 * Active chain — driven by env var.
 * VITE_ARC_MAINNET=true  → Arc Mainnet  (chain ID 5042)
 * (unset / anything else) → Arc Testnet  (chain ID 5042002)
 */
export const CHAIN_ID: number =
  import.meta.env.VITE_ARC_MAINNET === 'true' ? arc.id : 5042002

export const EXPLORER_BASE =
  import.meta.env.VITE_ARC_MAINNET === 'true'
    ? 'https://explorer.arc.io'
    : 'https://explorer.testnet.arc.io'

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1_000_000
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
    useGrouping: true,
  }).format(n)
}

export function parseUsdcInput(s: string): bigint {
  const n = parseFloat(s)
  if (isNaN(n) || n < 0) return 0n
  return BigInt(Math.round(n * 1_000_000))
}

export function txExplorerUrl(hash: string): string {
  try {
    return buildTxExplorerUrl(CHAIN_ID, hash)
  } catch {
    return `${EXPLORER_BASE}/tx/${hash}`
  }
}

export function addressExplorerUrl(addr: string): string {
  try {
    return buildAddressExplorerUrl(CHAIN_ID, addr)
  } catch {
    return `${EXPLORER_BASE}/address/${addr}`
  }
}

export function chainName(): string {
  try {
    return requireChain(CHAIN_ID).name
  } catch {
    return 'Arc Testnet'
  }
}

export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Overdue'
  const d = Math.floor(secondsLeft / 86400)
  const h = Math.floor((secondsLeft % 86400) / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function parseOnchainError(err: unknown): string {
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('toosoon')) return 'Check-in interval has not elapsed yet.'
  if (msg.includes('alreadyreleased')) return 'Vault has already been released.'
  if (msg.includes('notowner')) return 'Only the vault owner can do this.'
  if (msg.includes('notactive')) return 'Vault is no longer active.'
  if (msg.includes('invalidshares')) return 'Shares must total exactly 100%.'
  if (msg.includes('vaultnotfound')) return 'Vault not found.'
  if (msg.includes('nothingtoclaim')) return 'Nothing to claim.'
  if (msg.includes('reverted')) return 'Transaction failed. Check your inputs and balance.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error — please retry.'
  return 'Something went wrong. Please try again.'
}

export const INTERVAL_OPTIONS = [
  { label: '2 minutes (test)', seconds: 120 },
  { label: '7 days', seconds: 7 * 86400 },
  { label: '30 days', seconds: 30 * 86400 },
  { label: '90 days', seconds: 90 * 86400 },
] as const
