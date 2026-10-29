import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { erc20Abi, parseAbiItem } from 'viem'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import {
  formatUsdc, parseUsdcInput, formatAddress, formatCountdown,
  parseOnchainError, txExplorerUrl, CHAIN_ID, downloadIcs,
} from '@/utils'
import { getUsdc } from '@/onchain-facts'
import { TxResult } from './TxResult'
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, Users, CalendarPlus, History, Copy, Check } from 'lucide-react'

const USDC_ADDRESS = (getUsdc(CHAIN_ID)?.address ?? '0x3600000000000000000000000000000000000000') as `0x${string}`

interface DepositEntry {
  sender: string
  amount: bigint
  txHash: string
}

interface Props {
  vaultId: bigint
}

type ActionTab = 'deposit' | 'withdraw' | 'update' | 'history' | 'beneficiaries' | null

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
      aria-label="Copy address"
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

export function VaultCard({ vaultId }: Props) {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [activeTab, setActiveTab] = useState<ActionTab>(null)
  const [amountInput, setAmountInput] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [deposits, setDeposits] = useState<DepositEntry[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const { data: vault, refetch: refetchVault } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaults',
    args: [vaultId],
    chainId: CHAIN_ID,
  })

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaultBalance',
    args: [vaultId],
    chainId: CHAIN_ID,
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, AMANA_VAULT_ADDRESS],
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })

  // Beneficiary count — we read index 0..9 until we hit a revert to find all beneficiaries
  // Simpler: read beneficiaries lazily when the tab is opened (see BeneficiariesPanel)

  const refetchAll = useCallback(() => {
    void refetchVault()
    void refetchBalance()
    void refetchAllowance()
  }, [refetchVault, refetchBalance, refetchAllowance])

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => { if (isSuccess) refetchAll() }, [isSuccess, refetchAll])

  // Fetch deposit history from Deposited events
  const fetchHistory = useCallback(async () => {
    if (!publicClient) return
    setLoadingHistory(true)
    try {
      const logs = await publicClient.getLogs({
        address: AMANA_VAULT_ADDRESS,
        event: parseAbiItem('event Deposited(uint256 indexed vaultId, address indexed sender, uint256 amount)'),
        args: { vaultId },
        fromBlock: 0n,
        toBlock: 'latest',
      })
      setDeposits(logs.map(l => ({
        sender: l.args.sender as string,
        amount: l.args.amount as bigint,
        txHash: l.transactionHash ?? '',
      })))
    } catch {
      setDeposits([])
    } finally {
      setLoadingHistory(false)
    }
  }, [publicClient, vaultId])

  if (!vault) {
    return (
      <div className="card animate-pulse h-32 flex items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading vault {vaultId.toString()}…</span>
      </div>
    )
  }

  const [owner, lastCheckIn, checkInInterval, pendingWindow, pendingSince, released, active] = vault
  const isOwner = address?.toLowerCase() === owner.toLowerCase()
  const deadline = Number(lastCheckIn) + Number(checkInInterval)
  const secondsLeft = deadline - now
  const isOverdue = secondsLeft <= 0

  // Pending release state
  const isPendingRelease = Number(pendingSince) !== 0 && !released
  const pendingWindowSecs = Number(pendingWindow)
  const pendingExpiry = Number(pendingSince) + pendingWindowSecs
  const pendingSecsLeft = pendingExpiry - now
  const isPendingWindowExpired = isPendingRelease && pendingSecsLeft <= 0

  // Warning threshold: 14 days OR last 25% of interval, whichever is larger
  const warningThresholdSecs = Math.max(14 * 86400, Number(checkInInterval) * 0.25)
  const isWarning = !isOverdue && !released && !isPendingRelease && secondsLeft <= warningThresholdSecs

  const parsedAmount = parseUsdcInput(amountInput)
  const needsApprove = activeTab === 'deposit' && parsedAmount > 0n && (allowance ?? 0n) < parsedAmount

  function runTx(fn: () => void) {
    setTxError(null)
    reset()
    try { fn() } catch (e) { setTxError(parseOnchainError(e)) }
  }

  function handleApprove() {
    runTx(() => writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [AMANA_VAULT_ADDRESS, parsedAmount],
    }, {
      onSuccess: () => { void refetchAllowance() },
      onError: (e) => setTxError(parseOnchainError(e)),
    }))
  }

  function handleDeposit() {
    if (parsedAmount === 0n) { setTxError('Enter an amount.'); return }
    runTx(() => writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'deposit',
      args: [vaultId, parsedAmount],
    }, { onError: (e) => setTxError(parseOnchainError(e)) }))
  }

  function handleWithdraw() {
    if (parsedAmount === 0n) { setTxError('Enter an amount.'); return }
    runTx(() => writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'withdraw',
      args: [vaultId, parsedAmount],
    }, { onError: (e) => setTxError(parseOnchainError(e)) }))
  }

  function handleCheckIn() {
    runTx(() => writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'checkIn',
      args: [vaultId],
    }, { onError: (e) => setTxError(parseOnchainError(e)) }))
  }

  const statusColor = released
    ? 'text-[var(--muted)]'
    : isPendingWindowExpired
    ? 'text-[var(--danger)]'
    : isPendingRelease
    ? 'text-orange-400'
    : isOverdue
    ? 'text-[var(--danger)]'
    : isWarning
    ? 'text-yellow-400'
    : 'text-[var(--success)]'

  const statusLabel = released
    ? 'Released'
    : isPendingWindowExpired
    ? 'Release ready to finalize'
    : isPendingRelease
    ? 'Release pending'
    : active
    ? (isOverdue ? 'Overdue' : isWarning ? 'Check in soon' : 'Active')
    : 'Inactive'

  const cardStyle: React.CSSProperties = isPendingWindowExpired && !released
    ? { boxShadow: '0 0 0 1px rgba(248,113,113,0.45), 0 8px 32px rgba(248,113,113,0.15)' }
    : isPendingRelease && !released
    ? { boxShadow: '0 0 0 1px rgba(251,146,60,0.40), 0 8px 32px rgba(251,146,60,0.12)' }
    : isOverdue && !released
    ? { boxShadow: '0 0 0 1px rgba(248,113,113,0.35), 0 8px 32px rgba(248,113,113,0.12)' }
    : isWarning
    ? { boxShadow: '0 0 0 1px rgba(250,204,21,0.30), 0 8px 32px rgba(250,204,21,0.08)' }
    : {}

  const cardAccentClass = released ? 'card-teal' : isOverdue ? '' : isPendingRelease ? '' : isWarning ? '' : 'card-blue'

  return (
    <div className={`card space-y-4 ${cardAccentClass}`} style={cardStyle}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Vault</span>
            <span style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(10,16,36,0.80)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 5, padding: '1px 6px', color: '#b8cfeb',
            }}>
              #{vaultId.toString()}
            </span>
          </div>
          <div className={`mt-0.5 text-xs font-semibold ${statusColor}`}>{statusLabel}</div>
        </div>
        <button
          onClick={refetchAll}
          className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Balance */}
      <div className="text-center py-1">
        <div className="display text-3xl font-bold text-[var(--ink)] tabular-nums tracking-tight">
          {balance !== undefined ? formatUsdc(balance) : '—'}
        </div>
        <div className="text-sm text-[var(--muted)] mt-0.5">USDC in vault</div>
      </div>

      {/* Countdown — check-in timer (hidden while pending release is active) */}
      {!released && !isPendingRelease && (
        <div style={{
          borderRadius: 8, padding: '8px 12px', textAlign: 'center',
          fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          ...(isOverdue
            ? { border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#f87171' }
            : isWarning
            ? { border: '1px solid rgba(250,204,21,0.35)', background: 'rgba(250,204,21,0.07)', color: '#fde047' }
            : { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,16,36,0.80)', color: '#b8cfeb' }
          ),
        }}>
          {isOverdue
            ? 'Vault can be released now'
            : isWarning
            ? `Check in soon — ${formatCountdown(secondsLeft)} remaining`
            : `Next check-in in ${formatCountdown(secondsLeft)}`}
        </div>
      )}

      {/* Pending release banner */}
      {isPendingRelease && !released && (
        <div style={{
          borderRadius: 8, padding: '10px 14px', fontSize: 13,
          border: isPendingWindowExpired
            ? '1px solid rgba(248,113,113,0.45)'
            : '1px solid rgba(251,146,60,0.40)',
          background: isPendingWindowExpired
            ? 'rgba(248,113,113,0.08)'
            : 'rgba(251,146,60,0.07)',
          color: isPendingWindowExpired ? '#f87171' : '#fb923c',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontWeight: 600 }}>
            {isPendingWindowExpired
              ? 'Release window expired — ready to finalize'
              : `Release pending — ${formatCountdown(pendingSecsLeft)} to cancel`}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {isPendingWindowExpired
              ? 'Anyone can now call Finalize Release to distribute funds to beneficiaries.'
              : 'Check in now to cancel the release and restart your timer.'}
          </div>
        </div>
      )}

      {/* Warning banner (only when no pending release active) */}
      {isWarning && !isOverdue && !isPendingRelease && (
        <div style={{
          borderRadius: 8, padding: '8px 12px', fontSize: 12,
          border: '1px solid rgba(250,204,21,0.28)',
          background: 'rgba(250,204,21,0.06)',
          color: '#fde047',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
          <span>
            Check-in deadline approaching. Check in now to restart the full timer.
            Deadline: <strong>{new Date(deadline * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </span>
        </div>
      )}

      {/* Calendar button */}
      {!released && (
        <button
          type="button"
          onClick={() => downloadIcs(vaultId, deadline)}
          className="btn-ghost text-xs flex items-center gap-1.5 w-full justify-center py-1.5"
        >
          <CalendarPlus size={13} />
          Add check-in deadline to calendar (.ics)
        </button>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
        <div>
          <div className="font-medium text-[var(--ink-2)]">Owner</div>
          <div className="flex items-center font-mono">
            {formatAddress(owner)}
            <CopyButton text={owner} />
          </div>
        </div>
        <div>
          <div className="font-medium text-[var(--ink-2)]">Last check-in</div>
          <div>{new Date(Number(lastCheckIn) * 1000).toLocaleString()}</div>
        </div>
        <div>
          <div className="font-medium text-[var(--ink-2)]">Check-in interval</div>
          <div>{formatCountdown(Number(checkInInterval))}</div>
        </div>
        <div>
          <div className="font-medium text-[var(--ink-2)]">Release delay</div>
          <div>{formatCountdown(Number(pendingWindow))}</div>
        </div>
      </div>

      {/* Owner actions */}
      {isOwner && !released && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheckIn}
              disabled={isPending || isConfirming}
              className="btn-primary flex-1 text-sm py-2"
              style={isPendingRelease && !isPendingWindowExpired ? {
                background: 'linear-gradient(135deg,#fb923c,#f59e0b)',
                boxShadow: '0 2px 12px rgba(251,146,60,0.30)',
              } : undefined}
            >
              {isPending && activeTab === null
                ? 'Confirm…'
                : isPendingRelease && !isPendingWindowExpired
                ? 'Check in — cancel release'
                : 'Check in'}
            </button>
            {(['deposit', 'withdraw', 'update'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(activeTab === tab ? null : tab)}
                className={`btn-ghost flex-1 text-sm py-2 flex items-center justify-center gap-1 ${
                  activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)]' : ''
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'update' ? <Users size={13} /> : null}
                {activeTab === tab ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            ))}
          </div>

          {/* Deposit panel */}
          {activeTab === 'deposit' && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(10,16,36,0.85)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="label-sm">Amount to deposit (USDC)</label>
              <AmountInput value={amountInput} onChange={setAmountInput} />
              {needsApprove ? (
                <button onClick={handleApprove} disabled={isPending || isConfirming} className="btn-primary w-full text-sm">
                  {isPending ? 'Confirm…' : 'Approve USDC'}
                </button>
              ) : (
                <button onClick={handleDeposit} disabled={isPending || isConfirming || parsedAmount === 0n} className="btn-primary w-full text-sm">
                  {isPending ? 'Confirm…' : 'Deposit'}
                </button>
              )}
            </div>
          )}

          {/* Withdraw panel */}
          {activeTab === 'withdraw' && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(20,184,166,0.22)', background: 'rgba(10,16,36,0.85)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="label-sm">Amount to withdraw (USDC)</label>
              <AmountInput value={amountInput} onChange={setAmountInput} />
              <button onClick={handleWithdraw} disabled={isPending || isConfirming || parsedAmount === 0n} className="btn-primary w-full text-sm">
                {isPending ? 'Confirm…' : 'Withdraw'}
              </button>
            </div>
          )}

          {/* Update beneficiaries */}
          {activeTab === 'update' && (
            <UpdateBeneficiariesPanel vaultId={vaultId} onDone={() => setActiveTab(null)} />
          )}
        </div>
      )}

      {/* Beneficiaries viewer — available to everyone */}
      <div>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'beneficiaries' ? null : 'beneficiaries')}
          className={`btn-ghost text-xs flex items-center gap-1.5 w-full justify-center py-1.5 ${activeTab === 'beneficiaries' ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
        >
          <Users size={13} />
          Beneficiaries
          {activeTab === 'beneficiaries' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {activeTab === 'beneficiaries' && (
          <BeneficiariesViewer vaultId={vaultId} />
        )}
      </div>

      {/* Deposit history */}
      <div>
        <button
          type="button"
          onClick={() => {
            if (activeTab === 'history') {
              setActiveTab(null)
            } else {
              setActiveTab('history')
              if (deposits === null) void fetchHistory()
            }
          }}
          className={`btn-ghost text-xs flex items-center gap-1.5 w-full justify-center py-1.5 ${activeTab === 'history' ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
        >
          <History size={13} />
          Deposit history
          {activeTab === 'history' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {activeTab === 'history' && (
          <div style={{ marginTop: 8, borderRadius: 10, border: '1px solid rgba(59,130,246,0.18)', background: 'rgba(10,16,36,0.85)', padding: '10px 12px' }}>
            {loadingHistory ? (
              <p className="text-xs text-[var(--muted)] text-center py-2">Loading…</p>
            ) : !deposits || deposits.length === 0 ? (
              <p className="text-xs text-[var(--muted)] text-center py-2">No deposits found.</p>
            ) : (
              <div className="space-y-2">
                {deposits.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono text-[var(--ink-2)]">{formatAddress(d.sender)}</span>
                      <span className="text-[var(--muted)] ml-1.5">→</span>
                      <span className="tabular-nums font-medium text-[var(--success)] ml-1.5">+{formatUsdc(d.amount)} USDC</span>
                    </div>
                    {d.txHash && (
                      <a
                        href={txExplorerUrl(d.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--muted)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-0.5"
                        title="View on explorer"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tx feedback */}
      <TxResult
        hash={hash}
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        error={txError}
        successMsg="Done!"
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
  )
}

function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        step="0.000001"
        placeholder="0.00"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input w-full pr-14 tabular-nums"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--muted)] pointer-events-none">
        USDC
      </span>
    </div>
  )
}

// One row per beneficiary — each gets its own hook call (rules-of-hooks safe)
function BeneficiaryRow({ vaultId, index }: { vaultId: bigint; index: number }) {
  const { data } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'beneficiaries',
    args: [vaultId, BigInt(index)],
    chainId: CHAIN_ID,
  })
  if (!data || data[0] === '0x0000000000000000000000000000000000000000') return null
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1 font-mono text-[var(--ink-2)] min-w-0">
        <span className="text-[var(--muted)] shrink-0">{index + 1}.</span>
        <span className="truncate">{formatAddress(data[0])}</span>
        <CopyButton text={data[0]} />
      </div>
      <span className="tabular-nums font-semibold text-[var(--success)] shrink-0">
        {(Number(data[1]) / 100).toFixed(2)}%
      </span>
    </div>
  )
}

function BeneficiariesViewer({ vaultId }: { vaultId: bigint }) {
  return (
    <div style={{ marginTop: 8, borderRadius: 10, border: '1px solid rgba(139,92,246,0.18)', background: 'rgba(10,16,36,0.85)', padding: '10px 12px' }}>
      <div className="space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <BeneficiaryRow key={i} vaultId={vaultId} index={i} />
        ))}
      </div>
    </div>
  )
}

function UpdateBeneficiariesPanel({ vaultId, onDone }: { vaultId: bigint; onDone: () => void }) {
  const [rows, setRows] = useState([{ wallet: '', pct: '100' }])
  const [err, setErr] = useState<string | null>(null)
  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => { if (isSuccess) onDone() }, [isSuccess, onDone])

  const totalPct = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0)
  const sharesOk = Math.abs(totalPct - 100) < 0.001

  function addRow() { if (rows.length < 10) setRows(r => [...r, { wallet: '', pct: '0' }]) }
  function removeRow(i: number) { if (rows.length > 1) setRows(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, f: 'wallet' | 'pct', v: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row))
  }

  function handleSubmit() {
    setErr(null)
    reset()
    for (const r of rows) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(r.wallet)) { setErr('All addresses must be valid 0x addresses.'); return }
      if ((parseFloat(r.pct) || 0) <= 0) { setErr('All shares must be > 0%.'); return }
    }
    if (!sharesOk) { setErr(`Total is ${totalPct.toFixed(2)}% — must be 100%.`); return }

    const rawBps = rows.map(r => Math.floor((parseFloat(r.pct) / 100) * 10000))
    const diff = 10000 - rawBps.reduce((a, b) => a + b, 0)
    rawBps[rawBps.length - 1] += diff

    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'updateBeneficiaries',
      args: [vaultId, rows.map(r => r.wallet as `0x${string}`), rawBps.map(b => b) as unknown as readonly number[]],
    }, { onError: (e) => setErr(parseOnchainError(e)) })
  }

  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(10,16,36,0.85)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="label-sm">Update beneficiaries</p>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input type="text" placeholder="0x address" value={row.wallet}
            onChange={e => updateRow(i, 'wallet', e.target.value)}
            className="input flex-1 font-mono text-xs" spellCheck={false} />
          <div className="relative w-20 shrink-0">
            <input type="number" min="0" max="100" step="0.01" value={row.pct}
              onChange={e => updateRow(i, 'pct', e.target.value)}
              className="input w-full pr-5 tabular-nums" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] pointer-events-none">%</span>
          </div>
          {rows.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} className="mt-2 text-[var(--muted)] hover:text-[var(--danger)]">
              <span className="sr-only">Remove</span>✕
            </button>
          )}
        </div>
      ))}
      {rows.length < 10 && (
        <button type="button" onClick={addRow} className="btn-ghost text-xs flex items-center gap-1">+ Add beneficiary</button>
      )}
      <div className={`text-xs tabular-nums font-medium ${sharesOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
        Total: {totalPct.toFixed(2)}%
      </div>
      {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
      <button onClick={handleSubmit} disabled={isPending || isConfirming} className="btn-primary w-full text-sm">
        {isPending ? 'Confirm…' : isConfirming ? 'Confirming…' : 'Save changes'}
      </button>
      <TxResult hash={hash} isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} successMsg="Beneficiaries updated!" />
    </div>
  )
}
