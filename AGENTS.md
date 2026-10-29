# AmanahVault

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

AmanahVault is a dead-man's-switch USDC inheritance vault on Arc. The owner deposits USDC, checks in periodically, and if they miss their check-in window anyone can call `startRelease()` to begin a cancellable pending window. Once the pending window elapses, anyone can call `finalizeRelease()` to distribute the balance to beneficiaries by share (basis points). The owner can cancel by calling `checkIn()` during the pending window. Beneficiaries then pull their individual share via `claim()`.

## Deployed Contracts

| Contract | Chain | Address | Explorer |
|---|---|---|---|
| AmanahVault (single-tenant v1, deprecated) | Arc Testnet | 0xa774c2c2af6ca4f0cc5a08fe8b47b98d1e1f92a7 | https://explorer.testnet.arc.io/address/0xa774c2c2af6ca4f0cc5a08fe8b47b98d1e1f92a7 |
| AmanahVault (multi-tenant v1, retired) | Arc Testnet | 0x45046EA5600dB33bAC486439A3A30C82B101016F | https://explorer.testnet.arc.io/address/0x45046EA5600dB33bAC486439A3A30C82B101016F |
| AmanahVault (multi-tenant v2, **active**) | Arc Testnet | 0x6103ac5a11f639a66b3d25bc9da918c4c714e54d | https://explorer.testnet.arc.io/address/0x6103ac5a11f639a66b3d25bc9da918c4c714e54d |

Constructor args (v2 deploy):
- `_usdc`: `0x3600000000000000000000000000000000000000` (USDC on Arc Testnet/Mainnet)

Vault struct (7 fields): `owner`, `lastCheckIn`, `checkInInterval`, `pendingWindow`, `pendingSince`, `released`, `active`
Constants: `MIN_PENDING_WINDOW = 60s`, `MAX_PENDING_WINDOW = 2592000s (30 days)`

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
