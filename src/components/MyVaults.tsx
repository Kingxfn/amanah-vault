import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useReadContract } from 'wagmi'
import { AMANA_VAULT_ADDRESS, AMANA_VAULT_ABI } from '@/contract'
import { CHAIN_ID } from '@/utils'
import { VaultCard } from './VaultCard'
import { CreateVaultForm } from './CreateVaultForm'
import { ChainGuard } from './ChainGuard'
import { Vault, PlusCircle } from 'lucide-react'

export function MyVaults() {
  const { address, isConnected } = useAccount()
  const [showCreate, setShowCreate] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: vaultCount } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaultCount',
    chainId: CHAIN_ID,
  })

  // We scan all vaults and show ones owned by the connected address
  // vaultCount is the total; we read up to 50 for now
  const total = vaultCount ? Number(vaultCount) : 0

  if (!isConnected) {
    return (
      <div className="text-center py-16 space-y-3">
        <Vault size={40} className="mx-auto text-[var(--muted)]" strokeWidth={1.5} />
        <p className="text-[var(--muted)] text-sm">Connect your wallet to view your vaults.</p>
      </div>
    )
  }

  return (
    <ChainGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-2xl font-bold text-[var(--ink)] tracking-tight">My vaults</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">{total} vault{total !== 1 ? 's' : ''} on-chain</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className={`btn-primary flex items-center gap-1.5 text-sm px-4 py-2 ${showCreate ? 'opacity-70' : ''}`}
        >
          <PlusCircle size={15} />
          {showCreate ? 'Cancel' : 'New vault'}
        </button>
      </div>

      {showCreate && (
        <div className="card card-blue">
          <h3 className="display text-lg font-semibold text-[var(--ink)] mb-4">Create a vault</h3>
          <CreateVaultForm onCreated={() => { setShowCreate(false); setRefreshKey(k => k + 1) }} />
        </div>
      )}

      {total === 0 && !showCreate && (
        <div className="card card-teal text-center py-10 space-y-3">
          <Vault size={36} className="mx-auto text-[var(--muted)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No vaults yet. Create your first vault above.</p>
        </div>
      )}

      {total > 0 && (
        <VaultList key={refreshKey} ownerAddress={address!} total={total} />
      )}
    </div>
    </ChainGuard>
  )
}

function VaultList({ ownerAddress, total }: { ownerAddress: string; total: number }) {
  // Render up to 50 vault IDs and filter by owner inside each VaultCard
  // We do this by scanning all IDs and only showing those whose owner matches
  const ids = Array.from({ length: Math.min(total, 50) }, (_, i) => BigInt(i + 1))

  return (
    <OwnedVaultList ids={ids} ownerAddress={ownerAddress} />
  )
}

function OwnedVaultList({ ids, ownerAddress }: { ids: bigint[]; ownerAddress: string }) {
  return (
    <div className="space-y-4">
      {ids.map(id => (
        <ScanAndShow
          key={id.toString()}
          vaultId={id}
          ownerAddress={ownerAddress}
        />
      ))}
    </div>
  )
}

function ScanAndShow({ vaultId, ownerAddress }: { vaultId: bigint; ownerAddress: string }) {
  const { data: vault } = useReadContract({
    address: AMANA_VAULT_ADDRESS,
    abi: AMANA_VAULT_ABI,
    functionName: 'vaults',
    args: [vaultId],
    chainId: CHAIN_ID,
  })

  if (!vault) return null
  const owner = vault[0]
  if (owner.toLowerCase() !== ownerAddress.toLowerCase()) return null

  return <VaultCard vaultId={vaultId} />
}
