/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Chain selection:
 *   Default (VITE_ARC_MAINNET unset): Arc Testnet (5042002)
 *   Mainnet  (VITE_ARC_MAINNET=true):  Arc Mainnet (5042)
 *
 * Both chains are registered so MetaMask can prompt a switch; the active
 * chain is determined by CHAIN_ID in src/utils.ts.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc } from 'viem/chains'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

/**
 * Arc Testnet — overriding viem's built-in arcTestnet so the RPC and
 * block explorer match the current official values.
 */
export const arcTestnetCustom = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
  testnet: true,
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnetCustom.id, 'https://rpc.testnet.arc.io')
registerChain(arc.id, arc.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnetCustom, arc, mainnet], // arc testnet + mainnet; eth mainnet for ENS
  connectors: [injected()],
  transports: {
    [arcTestnetCustom.id]: http('https://rpc.testnet.arc.io'),
    [arc.id]: http(),
    [mainnet.id]: http(), // ENS resolution
  },
})
