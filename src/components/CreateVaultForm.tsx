import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import { INTERVAL_OPTIONS, parseOnchainError, txExplorerUrl } from '@/utils'
import { TxResult } from './TxResult'
import { ChainGuard } from './ChainGuard'

interface BeneficiaryRow {
  wallet: string
  pct: string // 0–100, stored as string for input
}

export function CreateVaultForm({ onCreated }: { onCreated?: () => void }) {
  const { isConnected } = useAccount()
  const [rows, setRows] = useState<BeneficiaryRow[]>([{ wallet: '', pct: '100' }])
  const [intervalIdx, setIntervalIdx] = useState(1) // default 7 days
  const [error, setError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const totalPct = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0)
  const sharesOk = Math.abs(totalPct - 100) < 0.001

  function addRow() {
    if (rows.length >= 10) return
    setRows(r => [...r, { wallet: '', pct: '0' }])
  }

  function removeRow(i: number) {
    if (rows.length === 1) return
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, field: keyof BeneficiaryRow, val: string) {
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))
  }

  function validate(): string | null {
    if (!isConnected) return 'Connect your wallet first.'
    if (rows.length === 0) return 'Add at least one beneficiary.'
    for (const r of rows) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(r.wallet)) return 'All beneficiary addresses must be valid 0x addresses.'
      const p = parseFloat(r.pct)
      if (isNaN(p) || p <= 0) return 'All shares must be greater than 0%.'
    }
    if (!sharesOk) return `Shares total ${totalPct.toFixed(2)}% — must equal exactly 100%.`
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    reset()
    const err = validate()
    if (err) { setError(err); return }

    // Convert pct → basis points (100% = 10000 bps)
    // Assign rounding remainder to last beneficiary so sum is exactly 10000
    const rawBps = rows.map(r => Math.floor((parseFloat(r.pct) / 100) * 10000))
    const diff = 10000 - rawBps.reduce((a, b) => a + b, 0)
    rawBps[rawBps.length - 1] += diff

    writeContract({
      address: AMANA_VAULT_ADDRESS,
      abi: AMANA_VAULT_ABI,
      functionName: 'createVault',
      args: [
        rows.map(r => r.wallet as `0x${string}`),
        rawBps.map(b => b) as unknown as readonly number[],
        BigInt(INTERVAL_OPTIONS[intervalIdx].seconds),
      ],
    }, {
      onSuccess: () => { onCreated?.() },
      onError: (e) => setError(parseOnchainError(e)),
    })
  }

  return (
    <ChainGuard>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Beneficiaries */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label-sm">Beneficiaries</label>
            <span className={`text-xs tabular-nums font-medium ${sharesOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {totalPct.toFixed(1)}% / 100%
            </span>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder="0x address"
                  value={row.wallet}
                  onChange={e => updateRow(i, 'wallet', e.target.value)}
                  className="input flex-1 font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="relative w-20 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    value={row.pct}
                    onChange={e => updateRow(i, 'pct', e.target.value)}
                    className="input w-full pr-5 tabular-nums"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] pointer-events-none">%</span>
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="mt-2 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                    aria-label="Remove beneficiary"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {rows.length < 10 && (
            <button
              type="button"
              onClick={addRow}
              className="btn-ghost text-sm flex items-center gap-1 mt-1"
            >
              <Plus size={14} /> Add beneficiary
            </button>
          )}
        </div>

        {/* Interval */}
        <div className="space-y-1.5">
          <label className="label-sm">Check-in interval</label>
          <div className="grid grid-cols-2 gap-2">
            {INTERVAL_OPTIONS.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntervalIdx(i)}
                style={intervalIdx === i ? {
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
                } : {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#b8cfeb',
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors hover:border-[var(--border-strong)]"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            If you miss a check-in, anyone can release your vault after this period.
          </p>
        </div>

        {/* Error inline */}
        {error && !isPending && !isConfirming && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {/* Submit */}
        {!isConnected ? (
          <p className="text-sm text-[var(--muted)]">Connect your wallet to create a vault.</p>
        ) : (
          <button
            type="submit"
            disabled={isPending || isConfirming}
            className="btn-primary w-full"
          >
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Create vault'}
          </button>
        )}

        <TxResult
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          successMsg="Vault created!"
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
      </form>
    </ChainGuard>
  )
}
