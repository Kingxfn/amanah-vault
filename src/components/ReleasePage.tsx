import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import {
  formatUsdc, formatAddress, formatCountdown,
  parseOnchainError, txExplorerUrl, CHAIN_ID,
} from '@/utils'
import { TxResult } from './TxResult'
import { ExternalLink, Search, Shield } from 'lucide-react'
import { ChainGuard } from './ChainGuard'

export function ReleasePage() {
  const { address } = useAccount()
  const [vaultIdInput, setVaultIdInput] = useState('')
  const [vaultId, setVaultId] = useState<bigint | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [txError, setTxError] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  function handleLookup() {
    const n = parseInt(vaultIdInput.trim())
    if (!isNaN(n) && n > 0) setVaultId(BigInt(n))
  }

  const { data: vault, refetch: refetchVault } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaults',
    args: [vaultId!],
    chainId: CHAIN_ID,
    query: { enabled: vaultId !== null },
  })

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaultBalance',
    args: [vaultId!],
    chainId: CHAIN_ID,
    query: { enabled: vaultId !== null },
  })

  const { data: myClaimable, refetch: refetchClaimable } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'claimable',
    args: [vaultId!, address!],
    chainId: CHAIN_ID,
    query: { enabled: vaultId !== null && !!address },
  })

  const refetchAll = useCallback(() => {
    void refetchVault(); void refetchBalance(); void refetchClaimable()
  }, [refetchVault, refetchBalance, refetchClaimable])

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => { if (isSuccess) refetchAll() }, [isSuccess, refetchAll])

  function handleRelease() {
    setTxError(null)
    reset()
    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'release',
      args: [vaultId!],
    }, { onError: (e) => setTxError(parseOnchainError(e)) })
  }

  function handleClaim() {
    setTxError(null)
    reset()
    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'claim',
      args: [vaultId!],
    }, { onError: (e) => setTxError(parseOnchainError(e)) })
  }

  const deadline = vault ? Number(vault[1]) + Number(vault[2]) : 0
  const secondsLeft = deadline - now
  const isOverdue = vault ? secondsLeft <= 0 : false
  const released = vault ? vault[3] : false
  const active = vault ? vault[4] : false

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-2xl font-bold text-[var(--ink)] tracking-tight">Release a vault</h2>
        <p className="text-sm text-[var(--muted)] mt-1 text-pretty">
          If a vault owner missed their check-in window, anyone can trigger the release. Beneficiaries can then claim their share.
        </p>
      </div>

      {/* Vault lookup */}
      <div className="card card-blue space-y-3">
        <label className="label-sm">Vault ID</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            placeholder="Enter vault ID"
            value={vaultIdInput}
            onChange={e => setVaultIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            className="input flex-1 tabular-nums"
          />
          <button onClick={handleLookup} className="btn-primary flex items-center gap-1.5 px-4">
            <Search size={15} /> Look up
          </button>
        </div>
      </div>

      {/* Vault details */}
      {vault && vaultId !== null && (
        <ChainGuard>
          <div className="card card-purple space-y-4">
            <div className="flex items-center justify-between">
              <span className="label-sm">Vault #{vaultId.toString()}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border`} style={
                released
                  ? { borderColor: 'rgba(255,255,255,0.09)', color: '#6a849f', background: 'rgba(10,16,36,0.80)' }
                  : isOverdue
                  ? { borderColor: 'rgba(248,113,113,0.35)', color: 'var(--danger)', background: 'rgba(248,113,113,0.08)' }
                  : { borderColor: 'rgba(52,211,153,0.35)', color: 'var(--success)', background: 'rgba(52,211,153,0.08)' }
              }>
                {released ? 'Released' : active ? (isOverdue ? 'Overdue — releasable' : 'Active') : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Owner</div>
                <div className="font-mono text-[var(--ink-2)]">{formatAddress(vault[0])}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Vault balance</div>
                <div className="tabular-nums font-semibold text-[var(--ink)]">
                  {balance !== undefined ? formatUsdc(balance) : '—'} USDC
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Last check-in</div>
                <div className="text-[var(--ink-2)]">{new Date(Number(vault[1]) * 1000).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Time remaining</div>
                <div className={`tabular-nums font-medium ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--ink-2)]'}`}>
                  {released ? 'N/A' : formatCountdown(secondsLeft)}
                </div>
              </div>
            </div>

            {/* Release button */}
            {!released && isOverdue && active && (
              <button
                onClick={handleRelease}
                disabled={isPending || isConfirming}
                className="btn-primary w-full"
              >
                {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Release vault'}
              </button>
            )}

            {/* Claim button */}
            {released && address && (myClaimable ?? 0n) > 0n && (
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)' }}>
                <div className="text-sm text-[var(--ink-2)]">
                  You can claim <span className="font-semibold tabular-nums">{formatUsdc(myClaimable!)}</span> USDC
                </div>
                <button
                  onClick={handleClaim}
                  disabled={isPending || isConfirming}
                  className="btn-primary w-full text-sm"
                >
                  {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Claim my share'}
                </button>
              </div>
            )}

            {released && address && (myClaimable ?? 0n) === 0n && (
              <p className="text-sm text-[var(--muted)]">No claimable balance for your address on this vault.</p>
            )}

            <TxResult
              hash={hash}
              isPending={isPending}
              isConfirming={isConfirming}
              isSuccess={isSuccess}
              error={txError}
              successMsg={isSuccess ? 'Success!' : undefined}
            />

            {isSuccess && hash && (
              <a
                href={txExplorerUrl(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--accent-hover)] hover:underline"
              >
                <ExternalLink size={11} />
                View on explorer.testnet.arc.io
              </a>
            )}
          </div>
        </ChainGuard>
      )}

      {/* What is this */}
      <div style={{
        borderRadius: 16,
        border: '1px solid rgba(139,92,246,0.28)',
        background: 'rgba(8,14,26,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(139,92,246,0.14), 0 8px 32px rgba(139,92,246,0.08)',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 600, color: '#eef4ff' }}>
          <Shield size={14} color="#a78bfa" />
          How release works
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Release is only possible after the owner misses their check-in deadline.',
            'Anyone can call release — not just beneficiaries.',
            'Release writes each beneficiary\'s share to a claimable balance.',
            'Each beneficiary then pulls their own funds using Claim.',
            'Release can only happen once per vault.',
          ].map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6a849f' }}>
              <span style={{ color: '#8b5cf6', flexShrink: 0 }}>•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
