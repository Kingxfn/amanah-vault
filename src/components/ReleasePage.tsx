import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { erc20Abi } from 'viem'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import {
  formatUsdc, formatAddress, formatCountdown,
  parseOnchainError, parseUsdcInput, txExplorerUrl, CHAIN_ID, EXPLORER_BASE,
} from '@/utils'
import { getUsdc } from '@/onchain-facts'
import { TxResult } from './TxResult'
import { ExternalLink, Search, Shield, AlertTriangle, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { ChainGuard } from './ChainGuard'

const USDC_ADDRESS = (getUsdc(CHAIN_ID)?.address ?? '0x3600000000000000000000000000000000000000') as `0x${string}`

const EXPLORER_HOST = EXPLORER_BASE.replace('https://', '')

export function ReleasePage() {
  const { address } = useAccount()
  const [vaultIdInput, setVaultIdInput] = useState('')
  const [vaultId, setVaultId] = useState<bigint | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [txError, setTxError] = useState<string | null>(null)
  const [startConfirmed, setStartConfirmed] = useState(false)
  const [finalizeConfirmed, setFinalizeConfirmed] = useState(false)

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

  function handleStartRelease() {
    setTxError(null)
    reset()
    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'startRelease',
      args: [vaultId!],
    }, {
      onSuccess: () => setStartConfirmed(false),
      onError: (e) => setTxError(parseOnchainError(e)),
    })
  }

  function handleFinalizeRelease() {
    setTxError(null)
    reset()
    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'finalizeRelease',
      args: [vaultId!],
    }, {
      onSuccess: () => setFinalizeConfirmed(false),
      onError: (e) => setTxError(parseOnchainError(e)),
    })
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

  // Vault struct: owner, lastCheckIn, checkInInterval, pendingWindow, pendingSince, released, active
  const owner           = vault?.[0]
  const lastCheckIn     = vault ? Number(vault[1]) : 0
  const checkInInterval = vault ? Number(vault[2]) : 0
  const pendingWindow   = vault ? Number(vault[3]) : 0
  const pendingSince    = vault ? Number(vault[4]) : 0
  const released        = vault ? vault[5] : false
  const active          = vault ? vault[6] : false

  const deadline = lastCheckIn + checkInInterval
  const secondsLeft = deadline - now
  const isOverdue = vault ? secondsLeft <= 0 : false

  const isPending_ = pendingSince !== 0 && !released
  const pendingExpiry = pendingSince + pendingWindow
  const pendingSecsLeft = pendingExpiry - now
  const isPendingWindowExpired = isPending_ && pendingSecsLeft <= 0

  // Status badge
  const statusStyle = released
    ? { borderColor: 'rgba(255,255,255,0.09)', color: '#6a849f', background: 'rgba(10,16,36,0.80)' }
    : isPendingWindowExpired
    ? { borderColor: 'rgba(248,113,113,0.45)', color: 'var(--danger)', background: 'rgba(248,113,113,0.10)' }
    : isPending_
    ? { borderColor: 'rgba(251,146,60,0.45)', color: '#fb923c', background: 'rgba(251,146,60,0.08)' }
    : isOverdue
    ? { borderColor: 'rgba(248,113,113,0.35)', color: 'var(--danger)', background: 'rgba(248,113,113,0.08)' }
    : { borderColor: 'rgba(52,211,153,0.35)', color: 'var(--success)', background: 'rgba(52,211,153,0.08)' }

  const statusText = released
    ? 'Released'
    : isPendingWindowExpired
    ? 'Finalize ready'
    : isPending_
    ? 'Release pending'
    : active
    ? (isOverdue ? 'Overdue — releasable' : 'Active')
    : 'Inactive'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-2xl font-bold text-[var(--ink)] tracking-tight">Vault lookup</h2>
        <p className="text-sm text-[var(--muted)] mt-1 text-pretty">
          Look up any vault by ID. Beneficiaries can claim here after a release. Anyone can deposit, start a release once the check-in period expires, or finalize it once the release delay passes. The person who triggers start or finalize receives nothing.
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
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={statusStyle}>
                {statusText}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Owner</div>
                <div className="font-mono text-[var(--ink-2)]">{formatAddress(owner!)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Vault balance</div>
                <div className="tabular-nums font-semibold text-[var(--ink)]">
                  {balance !== undefined ? formatUsdc(balance) : '—'} USDC
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Last check-in</div>
                <div className="text-[var(--ink-2)]">{new Date(lastCheckIn * 1000).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Release delay</div>
                <div className="text-[var(--ink-2)]">{formatCountdown(pendingWindow)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Check-in interval</div>
                <div className="text-[var(--ink-2)]">{formatCountdown(checkInInterval)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">
                  {isPending_ ? 'Cancellation window' : 'Time remaining'}
                </div>
                <div className={`tabular-nums font-medium ${
                  isPendingWindowExpired ? 'text-[var(--danger)]'
                  : isPending_ ? 'text-orange-400'
                  : isOverdue ? 'text-[var(--danger)]'
                  : 'text-[var(--ink-2)]'}`}>
                  {released
                    ? 'N/A'
                    : isPending_
                    ? (isPendingWindowExpired ? 'Expired — finalize now' : `${formatCountdown(pendingSecsLeft)} to cancel`)
                    : formatCountdown(secondsLeft)}
                </div>
              </div>
            </div>

            {/* Step 1: Start Release */}
            {!released && !isPending_ && isOverdue && active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  borderRadius: 10, padding: '10px 14px',
                  border: '1px solid rgba(248,113,113,0.35)',
                  background: 'rgba(248,113,113,0.07)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#f87171' }}>
                    <strong style={{ color: '#fca5a5' }}>Starting a release is serious.</strong> The vault owner will be notified via the app and has {formatCountdown(pendingWindow)} to cancel it by checking in. If they do not, the release becomes final and irreversible — funds will be distributed to beneficiaries only.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, color: '#b8cfeb' }}>
                  <input
                    type="checkbox"
                    checked={startConfirmed}
                    onChange={e => setStartConfirmed(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#f87171', flexShrink: 0, cursor: 'pointer' }}
                  />
                  I understand that starting a release is a serious action. I am not expecting to receive any funds.
                </label>
                <button
                  onClick={handleStartRelease}
                  disabled={isPending || isConfirming || !startConfirmed}
                  style={{
                    borderRadius: 10, padding: '10px 0', width: '100%',
                    background: startConfirmed
                      ? 'linear-gradient(135deg,#ef4444,#8b5cf6)'
                      : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    color: startConfirmed ? '#fff' : '#6a849f',
                    fontWeight: 600, fontSize: 14,
                    cursor: startConfirmed ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    transition: 'background 0.2s',
                    opacity: isPending || isConfirming ? 0.6 : 1,
                  }}
                >
                  {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Start release'}
                </button>
              </div>
            )}

            {/* Pending release info */}
            {isPending_ && !isPendingWindowExpired && (
              <div style={{
                borderRadius: 10, padding: '10px 14px',
                border: '1px solid rgba(251,146,60,0.40)',
                background: 'rgba(251,146,60,0.07)',
                fontSize: 12, color: '#fb923c',
              }}>
                <strong style={{ color: '#fed7aa' }}>Release in progress.</strong> The vault owner has {formatCountdown(pendingSecsLeft)} to cancel by checking in. If they do not, finalize release will become available.
              </div>
            )}

            {/* Step 2: Finalize Release */}
            {!released && isPendingWindowExpired && active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  borderRadius: 10, padding: '10px 14px',
                  border: '1px solid rgba(248,113,113,0.45)',
                  background: 'rgba(248,113,113,0.08)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#f87171' }}>
                    <strong style={{ color: '#fca5a5' }}>Finalizing is permanent.</strong> Once you finalize, funds are irrevocably allocated to beneficiaries and cannot be recovered by the owner. This action cannot be undone.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, color: '#b8cfeb' }}>
                  <input
                    type="checkbox"
                    checked={finalizeConfirmed}
                    onChange={e => setFinalizeConfirmed(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#f87171', flexShrink: 0, cursor: 'pointer' }}
                  />
                  I understand that finalizing is permanent and irreversible. I am not expecting to receive any funds.
                </label>
                <button
                  onClick={handleFinalizeRelease}
                  disabled={isPending || isConfirming || !finalizeConfirmed}
                  style={{
                    borderRadius: 10, padding: '10px 0', width: '100%',
                    background: finalizeConfirmed
                      ? 'linear-gradient(135deg,#ef4444,#8b5cf6)'
                      : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(248,113,113,0.45)',
                    color: finalizeConfirmed ? '#fff' : '#6a849f',
                    fontWeight: 600, fontSize: 14,
                    cursor: finalizeConfirmed ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    transition: 'background 0.2s',
                    opacity: isPending || isConfirming ? 0.6 : 1,
                  }}
                >
                  {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Finalize release'}
                </button>
              </div>
            )}

            {/* Claim */}
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

            {/* Third-party deposit — available when vault is active */}
            {!released && active && vaultId !== null && (
              <ThirdPartyDepositPanel vaultId={vaultId} onDeposited={refetchAll} />
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
                View on {EXPLORER_HOST}
              </a>
            )}
          </div>
        </ChainGuard>
      )}

      {/* How release works */}
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
            'Step 1: Anyone can call Start Release once the full check-in period has passed with no check-in.',
            'Step 2: The vault owner has a window (set at vault creation) to cancel by checking in.',
            'Step 3: Once the release window expires, anyone can call Finalize Release.',
            'Finalizing distributes funds to beneficiaries. The person who triggers any step receives nothing.',
            'Each beneficiary then pulls their own funds using Claim.',
            'Release can only happen once per vault. It is irreversible.',
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

function ThirdPartyDepositPanel({ vaultId, onDeposited }: { vaultId: bigint; onDeposited: () => void }) {
  const { address } = useAccount()
  const [open, setOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const parsedAmount = parseUsdcInput(amountInput)

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, AMANA_VAULT_ADDRESS],
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })

  const needsApprove = parsedAmount > 0n && (allowance ?? 0n) < parsedAmount

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function handleApprove() {
    setErr(null); reset()
    writeContract({
      address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve',
      args: [AMANA_VAULT_ADDRESS, parsedAmount],
    }, {
      onSuccess: () => { void refetchAllowance() },
      onError: (e) => setErr(parseOnchainError(e)),
    })
  }

  function handleDeposit() {
    if (parsedAmount === 0n) { setErr('Enter an amount.'); return }
    setErr(null); reset()
    writeContract({
      address: AMANA_VAULT_ADDRESS, abi: AMANA_VAULT_ABI, functionName: 'deposit',
      args: [vaultId, parsedAmount],
    }, {
      onSuccess: () => { setAmountInput(''); onDeposited() },
      onError: (e) => setErr(parseOnchainError(e)),
    })
  }

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`btn-ghost text-xs flex items-center gap-1.5 w-full justify-center py-1.5 ${open ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
      >
        <Send size={13} />
        Deposit to this vault
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(10,16,36,0.85)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!address ? (
            <p className="text-xs text-[var(--muted)]">Connect your wallet to deposit.</p>
          ) : (
            <>
              <label className="label-sm">Amount to deposit (USDC)</label>
              <div className="relative">
                <input
                  type="number" min="0" step="0.000001" placeholder="0.00"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="input w-full pr-14 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--muted)] pointer-events-none">USDC</span>
              </div>
              {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
              {needsApprove ? (
                <button onClick={handleApprove} disabled={isPending || isConfirming} className="btn-primary w-full text-sm">
                  {isPending ? 'Confirm…' : 'Approve USDC'}
                </button>
              ) : (
                <button onClick={handleDeposit} disabled={isPending || isConfirming || parsedAmount === 0n} className="btn-primary w-full text-sm">
                  {isPending ? 'Confirm…' : 'Deposit'}
                </button>
              )}
              <TxResult hash={hash} isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} successMsg="Deposited!" error={err} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
