import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi'
import { injected } from 'wagmi/connectors'
import {
  ExternalLink, Vault, PlusCircle, BookOpen, Send,
  CheckCircle2, Clock, Layers, Zap, Shield,
} from 'lucide-react'
import { Sidebar, MobileNav, type Page } from './components/Sidebar'
import { VaultScene } from './components/VaultScene'
import { MyVaults } from './components/MyVaults'
import { CreateVaultForm } from './components/CreateVaultForm'
import { ReleasePage } from './components/ReleasePage'
import { ChainGuard } from './components/ChainGuard'
import { addressExplorerUrl } from './utils'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from './contract'
import { getUsdc } from './onchain-facts'
import { formatUsdc } from './onchain-money'
import { CHAIN_ID } from './utils'

const USDC_ADDRESS = (getUsdc(CHAIN_ID)?.address ?? '0x3600000000000000000000000000000000000000') as `0x${string}`
const contractIsDeployed = AMANA_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000'

// ─── Shared inline-style helpers ──────────────────────────────────────────────
const glowCard = (accent: 'blue' | 'purple' | 'teal'): React.CSSProperties => {
  const map = {
    blue:   { border: 'rgba(59,130,246,0.30)',  glow: 'rgba(59,130,246,0.12)' },
    purple: { border: 'rgba(139,92,246,0.30)',  glow: 'rgba(139,92,246,0.12)' },
    teal:   { border: 'rgba(20,184,166,0.30)',  glow: 'rgba(20,184,166,0.12)' },
  }[accent]
  return {
    background: 'rgba(13,22,50,0.90)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${map.border}`,
    borderRadius: 16,
    padding: '16px 20px',
    boxShadow: `0 0 0 1px ${map.border}, 0 8px 32px ${map.glow}`,
  }
}

// ─── Top wallet bar ────────────────────────────────────────────────────────────
function WalletBar() {
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: usdcRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view',
            inputs: [{ name: '', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID,
    query: { enabled: isConnected && !!address },
  })

  const short   = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
  const balance = usdcRaw !== undefined ? formatUsdc(usdcRaw) : null

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(6,9,15,0.96)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px', gap: 12, minHeight: 52,
    }}>
      {/* Left: network badge only */}
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: 6,
        background: 'rgba(59,130,246,0.12)',
        color: '#60a5fa',
        border: '1px solid rgba(59,130,246,0.28)',
      }}>
        Arc Testnet
      </span>

      {/* Right: balance + address + disconnect/connect */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isConnected && balance !== null && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            padding: '4px 10px', borderRadius: 8,
            background: 'rgba(20,184,166,0.10)',
            color: '#2dd4bf',
            border: '1px solid rgba(20,184,166,0.22)',
          }}>
            {balance} USDC
          </span>
        )}
        {isConnected && (
          <span style={{
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: '#6a849f',
            background: 'rgba(255,255,255,0.04)',
            padding: '3px 7px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {short}
          </span>
        )}
        {isConnected ? (
          <button
            onClick={() => disconnect()}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: '5px 12px',
              fontSize: 12, fontWeight: 500, color: '#b8cfeb',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
            style={{
              background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              border: 'none', borderRadius: 9, padding: '7px 16px',
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              fontFamily: 'inherit',
              boxShadow: '0 3px 12px rgba(59,130,246,0.30)',
            }}
          >
            {isPending ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { isConnected } = useAccount()

  const { data: vaultCount } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaultCount',
    chainId: CHAIN_ID,
    query: { enabled: contractIsDeployed },
  })

  const totalVaults = contractIsDeployed && vaultCount !== undefined ? Number(vaultCount) : null

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>

      {/* ── Hero ── */}
      <div style={{
        display: 'flex', gap: 32, alignItems: 'center',
        flexWrap: 'wrap', marginBottom: 36,
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <VaultScene released={false} />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#60a5fa',
            background: 'rgba(59,130,246,0.10)',
            border: '1px solid rgba(59,130,246,0.24)',
            borderRadius: 6, padding: '3px 8px', marginBottom: 12,
          }}>
            USDC Dead-Man's Switch
          </div>
          <h1
            className="grad-text display"
            style={{ fontSize: 'clamp(1.7rem,3.8vw,2.5rem)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}
          >
            Protect your USDC<br />with AmanahVault
          </h1>
          <p style={{ color: '#6a849f', fontSize: 14, lineHeight: 1.75, margin: '0 0 22px', maxWidth: 340 }}>
            Deposit USDC, set your beneficiaries and choose a period.
            Check in once within your chosen period and your timer restarts. Only if the entire period passes with no check-in can anyone release the vault.
          </p>

          {/* CTA buttons */}
          {isConnected ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={() => onNavigate('create')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <PlusCircle size={15} />
                New Vault
              </button>
              <button
                className="btn-ghost"
                onClick={() => onNavigate('vaults')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Vault size={15} />
                My Vaults
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#6a849f' }}>
              Connect your wallet above to get started.
            </p>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 14, marginBottom: 36,
      }}>
        <StatCard
          accent="blue"
          value={totalVaults !== null ? String(totalVaults) : '—'}
          label="Total Vaults"
          icon={<Layers size={18} color="#3b82f6" />}
        />
        <StatCard
          accent="teal"
          value="USDC"
          label="Arc Testnet"
          icon={<Send size={18} color="#14b8a6" />}
        />
        <StatCard
          accent="purple"
          value="Pull-claim"
          label="Release Model"
          icon={<Shield size={18} color="#8b5cf6" />}
        />
        <StatCard
          accent="blue"
          value="Non-custodial"
          label="Architecture"
          icon={<Zap size={18} color="#3b82f6" />}
        />
      </div>

      {/* ── My vaults preview ── */}
      {isConnected && totalVaults !== null && totalVaults > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#eef4ff' }}>
              My Vaults
            </h2>
            <button
              onClick={() => onNavigate('vaults')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#60a5fa', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              View all <ExternalLink size={11} />
            </button>
          </div>
          <div style={{
            ...glowCard('blue'),
            padding: '14px 18px',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6a849f' }}>
              You have {totalVaults} vault{totalVaults !== 1 ? 's' : ''} onchain.{' '}
              <button
                onClick={() => onNavigate('vaults')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#60a5fa', fontSize: 13, fontFamily: 'inherit', padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Open the Vaults page
              </button>{' '}
              to manage them.
            </p>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#eef4ff' }}>
          How it works
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              icon: <PlusCircle size={18} color="#3b82f6" />,
              title: 'Create a vault',
              desc: 'Call Create Vault with your beneficiary addresses, percentage shares (must total 100%), and how often you must check in.',
              accent: 'blue' as const,
            },
            {
              icon: <Send size={18} color="#14b8a6" />,
              title: 'Deposit USDC',
              desc: 'Approve and deposit USDC at any time. The balance is tracked per-vault — funds are never pooled or mixed.',
              accent: 'teal' as const,
            },
            {
              icon: <CheckCircle2 size={18} color="#8b5cf6" />,
              title: 'Check in before your deadline',
              desc: 'Any check-in, on any day, restarts the full timer. Only if the entire period passes with no check-in can anyone release the vault.',
              accent: 'purple' as const,
            },
            {
              icon: <Clock size={18} color="#3b82f6" />,
              title: 'Release & Claim',
              desc: 'Once overdue, anyone can trigger Release. Beneficiaries then each call Claim to pull their own share. The owner can withdraw the full balance at any time while active.',
              accent: 'blue' as const,
            },
          ].map((step, i) => (
            <div key={i} style={{
              ...glowCard(step.accent),
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '14px 18px',
            }}>
              <div style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                background: step.accent === 'blue'
                  ? 'rgba(59,130,246,0.15)'
                  : step.accent === 'teal'
                  ? 'rgba(20,184,166,0.15)'
                  : 'rgba(139,92,246,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    color: '#3d5268',
                  }}>
                    STEP {i + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#eef4ff' }}>{step.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#6a849f', lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Safety notes ── */}
      <div style={{
        ...glowCard('purple'),
        padding: '16px 20px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Shield size={15} color="#a78bfa" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#eef4ff' }}>Safety notes</span>
        </div>
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {[
            'Unaudited. Use small amounts.',
            'Not a legal will.',
          ].map((note, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#6a849f' }}>
              <span style={{ color: '#8b5cf6', marginTop: 1, flexShrink: 0 }}>•</span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  accent, value, label, icon,
}: { accent: 'blue' | 'purple' | 'teal'; value: string; label: string; icon: React.ReactNode }) {
  const textColor = {
    blue:   '#60a5fa',
    purple: '#a78bfa',
    teal:   '#2dd4bf',
  }[accent]

  return (
    <div style={{ ...glowCard(accent) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: '#6a849f',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: 20, fontWeight: 800,
        color: textColor,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>('summary')

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg,#06090f 0%,#0a1020 50%,#0d1530 100%)',
      color: '#eef4ff',
      display: 'flex',
    }}>
      {/* Desktop sidebar */}
      <div className="md:flex hidden" style={{ flexShrink: 0 }}>
        <Sidebar page={page} onNavigate={setPage} />
      </div>

      {/* Main column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile nav strip */}
        <div className="md:hidden">
          <MobileNav page={page} onNavigate={setPage} />
        </div>

        {/* Top wallet bar */}
        <WalletBar />

        {/* Demo banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          padding: '8px 16px',
          background: 'linear-gradient(90deg,rgba(59,130,246,0.12),rgba(139,92,246,0.10))',
          borderBottom: '1px solid rgba(59,130,246,0.18)',
          fontSize: 12, color: '#93b8e8',
        }}>
          <span>
            <span style={{ fontWeight: 600, color: '#7dd3fc' }}>Arc Testnet demo.</span>
            {' '}Test USDC only, unaudited. Feedback welcome.
          </span>
          <a
            href="https://x.com/sufian_kingx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(59,130,246,0.18)',
              border: '1px solid rgba(59,130,246,0.30)',
              color: '#93c5fd', fontSize: 11, fontWeight: 600,
              textDecoration: 'none', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Give feedback ↗
          </a>
        </div>

        {/* Undeployed banner */}
        {!contractIsDeployed && (
          <div style={{
            margin: '16px 20px 0',
            borderRadius: 12,
            border: '1px solid rgba(245,158,11,0.30)',
            background: 'rgba(245,158,11,0.08)',
            padding: '10px 14px',
            fontSize: 13, color: '#fcd34d',
          }}>
            Contract not deployed — set{' '}
            <code style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
              VITE_VAULT_ADDRESS
            </code>{' '}
            in{' '}
            <code style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
              .env
            </code>.
          </div>
        )}

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '28px 20px 40px',
          maxWidth: 780, width: '100%', margin: '0 auto',
          overflowY: 'auto',
        }}>
          {page === 'summary' && <Dashboard onNavigate={setPage} />}
          {page === 'vaults'  && <ChainGuard><MyVaults /></ChainGuard>}
          {page === 'create'  && (
            <ChainGuard>
              <div style={{ maxWidth: 540 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#eef4ff' }}
                    className="display tracking-tight">
                  Create a vault
                </h2>
                <p style={{ fontSize: 13, color: '#6a849f', marginBottom: 20 }}>
                  Set your beneficiaries, shares, and check-in interval. The vault is created onchain immediately.
                </p>
                <div style={{ ...glowCard('blue') }}>
                  <CreateVaultForm onCreated={() => setPage('vaults')} />
                </div>
              </div>
            </ChainGuard>
          )}
          {page === 'release' && <ChainGuard><ReleasePage /></ChainGuard>}
          {page === 'howto'   && <HowItWorksPage />}
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '14px 20px',
          fontSize: 11, color: '#3d5268',
        }}>
          <div style={{
            maxWidth: 780, margin: '0 auto',
            display: 'flex', flexWrap: 'wrap', gap: 10,
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Unaudited. Use small amounts.</span>
              <span>Not a legal will.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {contractIsDeployed && (
                <a
                  href={addressExplorerUrl(AMANA_VAULT_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6a849f', textDecoration: 'none' }}
                >
                  <ExternalLink size={10} />
                  Contract
                </a>
              )}
              <span>Arc Testnet · USDC 0x3600…0000</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── How it works full page ───────────────────────────────────────────────────
function HowItWorksPage() {
  const steps = [
    {
      title: 'Create a vault',
      desc: 'Call createVault() with your beneficiary addresses, their percentage shares (must total 100%), and your preferred check-in interval (1 day to 1 year).',
      accent: 'blue' as const,
      icon: <PlusCircle size={20} color="#3b82f6" />,
    },
    {
      title: 'Deposit USDC',
      desc: 'Approve and deposit any amount of USDC. The balance is tracked per-vault — no pooling, no mixing. You can deposit multiple times.',
      accent: 'teal' as const,
      icon: <Send size={20} color="#14b8a6" />,
    },
    {
      title: 'Check in before your deadline',
      desc: 'Call checkIn() at any point before the period expires. Any check-in restarts the full timer. If the entire period passes with no check-in, anyone can call release().',
      accent: 'purple' as const,
      icon: <CheckCircle2 size={20} color="#8b5cf6" />,
    },
    {
      title: 'Release (permissionless)',
      desc: 'Once the vault is overdue, anyone can call release(). This computes each beneficiary\'s share and writes it to their claimable balance.',
      accent: 'blue' as const,
      icon: <Zap size={20} color="#3b82f6" />,
    },
    {
      title: 'Claim your share',
      desc: 'Each beneficiary independently calls claim() to pull their USDC. There is no admin key — no one can freeze or redirect funds once the vault is created.',
      accent: 'teal' as const,
      icon: <BookOpen size={20} color="#14b8a6" />,
    },
    {
      title: 'Withdraw (owner only)',
      desc: 'While the vault is active and not yet released, the owner can withdraw the full balance at any time using withdraw().',
      accent: 'purple' as const,
      icon: <Shield size={20} color="#8b5cf6" />,
    },
  ]

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 className="display tracking-tight"
          style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#eef4ff' }}>
        How it works
      </h2>
      <p style={{ fontSize: 13, color: '#6a849f', marginBottom: 24, lineHeight: 1.65 }}>
        AmanahVault is a non-custodial, multi-tenant USDC vault on Arc Testnet.
        No admin keys, no upgradeability, no proxies.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            ...glowCard(step.accent),
            display: 'flex', gap: 16, alignItems: 'flex-start',
            padding: '16px 20px',
          }}>
            <div style={{
              flexShrink: 0,
              width: 38, height: 38, borderRadius: '50%',
              background: step.accent === 'blue'
                ? 'rgba(59,130,246,0.14)'
                : step.accent === 'teal'
                ? 'rgba(20,184,166,0.14)'
                : 'rgba(139,92,246,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {step.icon}
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                fontSize: 9, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eef4ff', marginBottom: 5 }}>{step.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#6a849f', lineHeight: 1.65 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, ...glowCard('purple'), padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Shield size={14} color="#a78bfa" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#eef4ff' }}>Important notices</span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Unaudited. Use small amounts.',
            'Not a legal will.',
          ].map((note, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6a849f' }}>
              <span style={{ color: '#8b5cf6', flexShrink: 0 }}>•</span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
