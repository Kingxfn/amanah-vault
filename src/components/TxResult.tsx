import { ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { txExplorerUrl } from '@/utils'

interface Props {
  hash?: string
  isPending?: boolean
  isConfirming?: boolean
  isSuccess?: boolean
  error?: string | null
  successMsg?: string
}

const BASE: React.CSSProperties = {
  marginTop: 12,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(8,14,26,0.80)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: '10px 14px',
  fontSize: 13,
}

export function TxResult({ hash, isPending, isConfirming, isSuccess, error, successMsg }: Props) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null

  return (
    <div style={BASE}>
      {(isPending || isConfirming) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b8cfeb' }}>
          <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />
          <span>{isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'}</span>
        </div>
      )}
      {isSuccess && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 600 }}>
            <CheckCircle size={14} style={{ flexShrink: 0 }} />
            <span>{successMsg ?? 'Confirmed'}</span>
          </div>
          {hash && (
            <a
              href={txExplorerUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#bdd5f5', textDecoration: 'none', fontSize: 11, marginTop: 2 }}
            >
              <ExternalLink size={11} />
              View on explorer.testnet.arc.io
            </a>
          )}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#f87171' }}>
          <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
