import { useAccount, useReadContract, useDisconnect, useConnect } from 'wagmi'
import { erc20Abi } from 'viem'
import { Wifi, Wallet, LogOut, ChevronDown, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { formatUsdc, CHAIN_ID } from '@/utils'
import { getUsdc, requireChain } from '@/onchain-facts'

const USDC_ADDRESS = (getUsdc(CHAIN_ID)?.address ?? '0x3600000000000000000000000000000000000000') as `0x${string}`

function getNetworkName() {
  try { return requireChain(CHAIN_ID).name } catch { return 'Arc Testnet' }
}

function shortAddress(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function TopBar() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect, connectors, isPending } = useConnect()
  const [dropOpen, setDropOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  // Derived: if we just connected, treat the panel as closed
  const showConnectPanel = connectOpen && !isConnected
  const dropRef = useRef<HTMLDivElement>(null)
  const connectRef = useRef<HTMLDivElement>(null)

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })

  const networkName = getNetworkName()

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
      if (connectRef.current && !connectRef.current.contains(e.target as Node)) setConnectOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const popStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    minWidth: '200px',
    background: '#0d1b2f',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
    zIndex: 200,
    overflow: 'hidden',
  }

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-4 sm:px-6"
      style={{
        background: '#080e1aeb',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Mobile hamburger spacer */}
      <div className="w-10 md:hidden shrink-0" />

      {/* Network badge */}
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shrink-0"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#c8d8f0',
        }}
      >
        <Wifi size={11} style={{ color: '#34d399' }} />
        {networkName}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* USDC balance pill */}
        {address && usdcBalance !== undefined && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <span className="font-semibold tabular-nums" style={{ color: '#14b8a6' }}>
              {formatUsdc(usdcBalance)}
            </span>
            <span style={{ color: '#7a92b0' }}>USDC</span>
          </div>
        )}

        {/* Connect button */}
        {!isConnected ? (
          <div ref={connectRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setConnectOpen(v => !v)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                border: 'none',
                cursor: 'pointer',
                minHeight: '36px',
                boxShadow: '0 4px 14px rgba(59,130,246,0.30)',
              }}
            >
              <Wallet size={14} />
              {isPending ? 'Connecting…' : 'Connect'}
            </button>

            {showConnectPanel && (
              <div style={popStyle}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>Connect wallet</span>
                  <button onClick={() => setConnectOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a92b0', padding: 0 }}>
                    <X size={14} />
                  </button>
                </div>
                {connectors.map(connector => (
                  <button
                    key={connector.id}
                    onClick={() => connect({ connector })}
                    disabled={isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      color: '#c8d8f0',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      opacity: isPending ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(59,130,246,0.10)' }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                    >
                      {connector.name.slice(0, 2).toUpperCase()}
                    </span>
                    {connector.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Account dropdown */
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropOpen(v => !v)}
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#c8d8f0',
                cursor: 'pointer',
                minHeight: '36px',
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}
              >
                {address!.slice(2, 4).toUpperCase()}
              </span>
              {shortAddress(address!)}
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </button>

            {dropOpen && (
              <div style={popStyle}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs" style={{ color: '#7a92b0' }}>Connected</div>
                  <div className="text-sm font-mono mt-0.5" style={{ color: '#f0f6ff' }}>{shortAddress(address!)}</div>
                </div>
                <button
                  onClick={() => { disconnect(); setDropOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
                  style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(248,113,113,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                >
                  <LogOut size={13} />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
