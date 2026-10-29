import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { motion } from 'framer-motion'
import { Vault, Clock, DollarSign, AlertTriangle } from 'lucide-react'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import { CHAIN_ID, formatUsdc, formatCountdown } from '@/utils'
import { TiltCard } from './TiltCard'
import { VaultScene } from './VaultScene'

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] },
}

export function Dashboard() {
  const { address } = useAccount()
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [anyReleased, setAnyReleased] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const { data: vaultCount } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaultCount',
    chainId: CHAIN_ID,
  })

  const total = vaultCount ? Number(vaultCount) : 0

  // Scan up to 20 vaults for summary
  const ids = Array.from({ length: Math.min(total, 20) }, (_, i) => BigInt(i + 1))

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl border border-[var(--border)]"
        style={{ background: 'linear-gradient(135deg, rgba(14,31,56,0.9) 0%, rgba(10,18,35,0.95) 100%)' }}>

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
        />

        <div className="relative flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
          {/* Text */}
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-1 text-xs text-[var(--muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Live on Arc Testnet
            </div>
            <h1 className="display text-4xl font-bold text-balance">
              <span className="grad-text">Secure your</span><br />
              digital legacy
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-xs text-pretty">
              A USDC time-lock vault. Choose a period — check in any time before it expires to restart the full timer. If the entire period passes with no check-in, anyone can trigger the release, but only your listed beneficiaries can claim the funds.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-[var(--subtle)]">
              <span className="mono">{total}</span>
              <span>vault{total !== 1 ? 's' : ''} created onchain</span>
            </div>
          </div>

          {/* 3D Scene */}
          <div className="w-full md:w-72 h-56 shrink-0">
            <VaultScene released={anyReleased} />
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
          <TiltCard accent="blue">
            <div className="flex items-start justify-between">
              <div>
                <div className="label-sm mb-2">Total Vaults</div>
                <div className="display text-3xl font-bold text-[var(--ink)] tabular-nums">{total}</div>
                <div className="text-xs text-[var(--muted)] mt-1">onchain</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Vault size={18} className="text-[var(--accent-blue)]" />
              </div>
            </div>
          </TiltCard>
        </motion.div>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.10 }}>
          <TiltCard accent="purple">
            <div className="flex items-start justify-between">
              <div>
                <div className="label-sm mb-2">Your USDC</div>
                {address ? (
                  <WalletUsdcBalance address={address} />
                ) : (
                  <div className="display text-3xl font-bold text-[var(--muted)]">—</div>
                )}
                <div className="text-xs text-[var(--muted)] mt-1">wallet balance</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.15)' }}>
                <DollarSign size={18} className="text-[var(--accent-purple)]" />
              </div>
            </div>
          </TiltCard>
        </motion.div>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
          <TiltCard accent="teal">
            <div className="flex items-start justify-between">
              <div>
                <div className="label-sm mb-2">Next Check-in</div>
                {address && total > 0 ? (
                  <NextCheckIn ownerAddress={address} total={total} now={now} onReleased={setAnyReleased} />
                ) : (
                  <div className="display text-3xl font-bold text-[var(--muted)]">—</div>
                )}
                <div className="text-xs text-[var(--muted)] mt-1">earliest due</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(20,184,166,0.15)' }}>
                <Clock size={18} className="text-[var(--accent-teal)]" />
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </div>

      {/* How it works — compact */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.20 }}>
        <div className="card space-y-3">
          <div className="label-sm">How it works</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { n: '1', title: 'Create a vault', desc: 'Set beneficiaries, share splits, and a check-in interval.' },
              { n: '2', title: 'Check in before your deadline', desc: 'Any check-in resets the full timer. You only need to check in once per period — any day, any time.' },
              { n: '3', title: 'Release & Claim', desc: 'Once overdue, anyone can start a release. The owner then has a window to cancel by checking in. After the window closes, anyone can finalize — but only listed beneficiaries can claim funds.' },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }}>
                  {step.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">{step.title}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 text-pretty">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Warning — only shown when wallet is connected */}
      {address && ids.length > 0 && (
        <OverdueWarnings ids={ids} ownerAddress={address} now={now} />
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function WalletUsdcBalance({ address }: { address: string }) {
  const { data } = useReadContract({
    address: '0x3600000000000000000000000000000000000000',
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    chainId: CHAIN_ID,
    query: { refetchInterval: 15_000 },
  })
  return (
    <div className="display text-3xl font-bold text-[var(--ink)] tabular-nums">
      {data !== undefined ? formatUsdc(data) : '—'}
    </div>
  )
}

function NextCheckIn({ ownerAddress, total, now, onReleased }: {
  ownerAddress: string; total: number; now: number; onReleased: (v: boolean) => void
}) {
  // Find the vault owned by this address with the earliest upcoming deadline
  const ids = Array.from({ length: Math.min(total, 20) }, (_, i) => BigInt(i + 1))
  return <NextCheckInScan ids={ids} ownerAddress={ownerAddress} now={now} onReleased={onReleased} />
}

function NextCheckInScan({ ids, ownerAddress, now, onReleased }: {
  ids: bigint[]; ownerAddress: string; now: number; onReleased: (v: boolean) => void
}) {
  // Read all vaults — show the earliest non-released deadline for this owner
  return <MultiVaultSummary ids={ids} ownerAddress={ownerAddress} now={now} onReleased={onReleased} />
}

function MultiVaultSummary({ ids, ownerAddress, now, onReleased }: {
  ids: bigint[]; ownerAddress: string; now: number; onReleased: (v: boolean) => void
}) {
  // We render per-vault scanners and collect results
  return (
    <>
      {ids.map(id => (
        <VaultDeadlineScan key={id.toString()} vaultId={id} ownerAddress={ownerAddress} now={now} onReleased={onReleased} />
      ))}
    </>
  )
}

function VaultDeadlineScan({ vaultId, ownerAddress, now, onReleased }: {
  vaultId: bigint; ownerAddress: string; now: number; onReleased: (v: boolean) => void
}) {
  const { data: vault } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaults',
    args: [vaultId],
    chainId: CHAIN_ID,
  })
  if (!vault) return null
  const [owner, lastCheckIn, checkInInterval, , , released] = vault
  if (owner.toLowerCase() !== ownerAddress.toLowerCase()) return null
  if (released) { onReleased(true); return null }
  const deadline = Number(lastCheckIn) + Number(checkInInterval)
  const left = deadline - now
  return (
    <div className="display text-2xl font-bold tabular-nums" style={{ color: left <= 0 ? 'var(--danger)' : 'var(--ink)' }}>
      {formatCountdown(left)}
    </div>
  )
}

function OverdueWarnings({ ids, ownerAddress, now }: { ids: bigint[]; ownerAddress: string; now: number }) {
  return (
    <div className="space-y-2">
      {ids.map(id => (
        <OverdueCheck key={id.toString()} vaultId={id} ownerAddress={ownerAddress} now={now} />
      ))}
    </div>
  )
}

function OverdueCheck({ vaultId, ownerAddress, now }: { vaultId: bigint; ownerAddress: string; now: number }) {
  const { data: vault } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaults',
    args: [vaultId],
    chainId: CHAIN_ID,
  })
  if (!vault) return null
  const [owner, lastCheckIn, checkInInterval, , , released, active] = vault
  if (owner.toLowerCase() !== ownerAddress.toLowerCase()) return null
  if (released || !active) return null
  const deadline = Number(lastCheckIn) + Number(checkInInterval)
  const left = deadline - now
  if (left > 0) return null
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border border-[var(--danger)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
      <AlertTriangle size={15} className="shrink-0" />
      Vault #{vaultId.toString()} is overdue — check in now to cancel any pending release, or go to My Vaults to review it.
    </motion.div>
  )
}
