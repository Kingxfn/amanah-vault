import { useState, useMemo } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Plus, Trash2, ExternalLink, Calendar } from 'lucide-react'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import { INTERVAL_OPTIONS, parseOnchainError, txExplorerUrl } from '@/utils'
import { TxResult } from './TxResult'
import { ChainGuard } from './ChainGuard'

interface BeneficiaryRow {
  wallet: string
  pct: string
}

// -1 means "custom"
const PRESET_IDX_CUSTOM = -1

export function CreateVaultForm({ onCreated }: { onCreated?: () => void }) {
  const { isConnected } = useAccount()
  const [rows, setRows]         = useState<BeneficiaryRow[]>([{ wallet: '', pct: '100' }])
  const [intervalIdx, setIntervalIdx] = useState(1) // default 7 days
  const [customDays, setCustomDays]   = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Resolve seconds from selection
  const isCustom = intervalIdx === PRESET_IDX_CUSTOM
  const customSecs = isCustom
    ? Math.max(1, Math.floor(parseFloat(customDays) || 0)) * 86400
    : INTERVAL_OPTIONS[intervalIdx].seconds
  const intervalSeconds = isCustom ? customSecs : INTERVAL_OPTIONS[intervalIdx].seconds

  // Deadline preview — useMemo so Date.now() is not called on every render pass
  const deadlineDate = useMemo(
    () => intervalSeconds > 0 ? new Date(Date.now() + intervalSeconds * 1000) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intervalSeconds],
  )

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
    if (isCustom) {
      const d = parseFloat(customDays)
      if (isNaN(d) || d < 1) return 'Custom interval must be at least 1 day.'
    }
    if (!acknowledged) return 'Please confirm the acknowledgement before creating a vault.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    reset()
    const err = validate()
    if (err) { setError(err); return }

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
        BigInt(intervalSeconds),
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
        <div className="space-y-2">
          <label className="label-sm">Check-in interval</label>
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
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
                className="rounded-lg px-3 py-2 text-sm font-medium text-center transition-colors hover:border-[var(--border-strong)]"
              >
                {opt.label}
              </button>
            ))}
            {/* Custom */}
            <button
              type="button"
              onClick={() => setIntervalIdx(PRESET_IDX_CUSTOM)}
              style={isCustom ? {
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                border: '1px solid rgba(139,92,246,0.5)',
                color: '#fff',
                boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#b8cfeb',
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-center transition-colors hover:border-[var(--border-strong)]"
            >
              Custom…
            </button>
          </div>

          {/* Custom days input */}
          {isCustom && (
            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1 max-w-[160px]">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 60"
                  value={customDays}
                  onChange={e => setCustomDays(e.target.value)}
                  className="input w-full pr-10 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] pointer-events-none">days</span>
              </div>
              <span className="text-xs text-[var(--muted)]">whole days, min 1</span>
            </div>
          )}

          {/* Deadline preview */}
          {deadlineDate && intervalSeconds > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6a849f' }}>
              <Calendar size={12} style={{ flexShrink: 0 }} />
              First deadline: <span style={{ color: '#93b8e8', fontWeight: 500 }}>
                {deadlineDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              <span style={{ color: '#3d5268' }}>(if created now)</span>
            </div>
          )}

          <p className="text-xs text-[var(--muted)]">
            If the entire period passes with no check-in, anyone can trigger the release — but only your listed beneficiaries can claim the funds. A single check-in at any point resets the full timer.
          </p>
        </div>

        {/* Acknowledgement */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
          padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${acknowledged ? 'rgba(139,92,246,0.40)' : 'rgba(255,255,255,0.10)'}`,
          background: acknowledged ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
          transition: 'border-color 0.2s, background 0.2s',
        }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#8b5cf6', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
          />
          <span className="text-xs" style={{ color: '#b8cfeb', lineHeight: 1.6 }}>
            I understand that once a vault is released, the release is <strong style={{ color: '#eef4ff' }}>final and irreversible</strong>.
            This app is unaudited. This is <strong style={{ color: '#eef4ff' }}>not a legal will</strong> and creates no enforceable rights.
          </span>
        </label>

        {/* Error */}
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
