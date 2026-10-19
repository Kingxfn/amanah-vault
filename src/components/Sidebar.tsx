import { useState } from 'react'
import {
  LayoutDashboard, Vault, PlusCircle, Send, BookOpen, Menu, X,
} from 'lucide-react'

export type Page = 'summary' | 'vaults' | 'create' | 'release' | 'howto'

const NAV: { id: Page; label: string; icon: typeof Vault }[] = [
  { id: 'summary', label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'vaults',  label: 'My Vaults',      icon: Vault           },
  { id: 'create',  label: 'Create Vault',   icon: PlusCircle      },
  { id: 'release', label: 'Release & Claim',icon: Send            },
  { id: 'howto',   label: 'How It Works',   icon: BookOpen        },
]

const S = {
  sidebar: {
    width: 220,
    background: 'rgba(6,9,15,0.96)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    padding: '20px 10px',
    gap: 4,
    position: 'relative' as const,
    zIndex: 20,
  },
  logo: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: '6px 12px 18px',
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: 'Space Grotesk, system-ui, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    color: '#eef4ff',
    letterSpacing: '-0.02em',
  },
}

function NavItem({
  item, active, onClick,
}: { item: typeof NAV[0]; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit',
        textAlign: 'left' as const,
        transition: 'background 0.15s, color 0.15s',
        width: '100%',
        background: active
          ? 'linear-gradient(135deg,rgba(59,130,246,0.22),rgba(139,92,246,0.16))'
          : 'transparent',
        color: active ? '#eef4ff' : '#6a849f',
        boxShadow: active ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : 'none',
        position: 'relative' as const,
        zIndex: 1,
      }}
    >
      <Icon
        size={17}
        style={{ color: active ? '#60a5fa' : '#6a849f', flexShrink: 0 }}
      />
      {item.label}
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: 3,
            borderRadius: '0 3px 3px 0',
            background: 'linear-gradient(to bottom,#3b82f6,#8b5cf6)',
          }}
        />
      )}
    </button>
  )
}

interface Props {
  page: Page
  onNavigate: (p: Page) => void
}

export function Sidebar({ page, onNavigate }: Props) {
  return (
    <aside style={{ ...S.sidebar, width: S.sidebar.width, minHeight: '100dvh' }}>
      {/* Logo */}
      <div style={S.logo}>
        <div style={S.logoIcon}>
          <Vault size={16} color="#fff" />
        </div>
        <span style={S.logoText}>AmanahVault</span>
      </div>

      {/* Nav */}
      {NAV.map(item => (
        <NavItem
          key={item.id}
          item={item}
          active={page === item.id}
          onClick={() => onNavigate(item.id)}
        />
      ))}
    </aside>
  )
}

export function MobileNav({ page, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const current = NAV.find(n => n.id === page)!
  const CurrentIcon = current.icon

  return (
    <>
      {/* Top strip */}
      <div style={{
        position: 'sticky' as const,
        top: 0,
        zIndex: 50,
        background: 'rgba(6,9,15,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...S.logoIcon, width: 26, height: 26, borderRadius: 8 }}>
            <Vault size={13} color="#fff" />
          </div>
          <span style={{ ...S.logoText, fontSize: 13 }}>AmanahVault</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#90b4e0', fontSize: 13 }}>
            <CurrentIcon size={14} />
            <span style={{ fontWeight: 500 }}>{current.label}</span>
          </div>
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#eef4ff', padding: 4, display: 'flex',
              position: 'relative', zIndex: 1,
            }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <div style={{
          position: 'fixed' as const,
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 49,
          pointerEvents: 'none' as const,
        }}>
          {/* Backdrop — only the backdrop intercepts clicks, not the whole overlay div */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute' as const,
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'auto' as const,
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'absolute' as const,
            top: 0, left: 0, bottom: 0,
            width: 240,
            background: 'rgba(6,9,15,0.99)',
            borderRight: '1px solid rgba(255,255,255,0.09)',
            padding: '20px 10px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 4,
            pointerEvents: 'auto' as const,
          }}>
            <div style={{ ...S.logo, paddingBottom: 14 }}>
              <div style={S.logoIcon}><Vault size={16} color="#fff" /></div>
              <span style={S.logoText}>AmanahVault</span>
              <button
                onClick={() => setOpen(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6a849f' }}
              >
                <X size={18} />
              </button>
            </div>
            {NAV.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={page === item.id}
                onClick={() => { onNavigate(item.id); setOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
