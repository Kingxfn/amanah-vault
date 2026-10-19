import { useAccount, useSwitchChain } from 'wagmi'
import { CHAIN_ID, chainName } from '@/utils'
import { arcTestnetCustom } from '@/config'

export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const targetChain = CHAIN_ID === arcTestnetCustom.id ? arcTestnetCustom : undefined

  if (!isConnected) return <>{children}</>
  if (chainId === CHAIN_ID) return <>{children}</>

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--ink-2)] space-y-3">
      <p>Your wallet is on the wrong network. Switch to <strong>{chainName()}</strong> to continue.</p>
      <button
        onClick={() => switchChain({ chainId: CHAIN_ID, ...(targetChain ? { addEthereumChainParameter: { chainName: targetChain.name, rpcUrls: [targetChain.rpcUrls.default.http[0]], nativeCurrency: targetChain.nativeCurrency, blockExplorerUrls: [targetChain.blockExplorers.default.url] } } : {}) })}
        disabled={isPending}
        className="btn-primary text-sm px-4 py-2"
      >
        {isPending ? 'Switching…' : `Switch to ${chainName()}`}
      </button>
    </div>
  )
}
