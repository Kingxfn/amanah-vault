# AmanahVault

**A USDC inheritance vault on Arc.** If an owner stops checking in, their chosen beneficiaries can claim, with a cancellable release window to prevent accidental payouts. Built with Arc Studio.

- Live app: https://amanah-vaultapp.vercel.app
- Arc Mainnet contract: [`0x8681a05ba579704f3D165Fb874c3b61BBC68eAd7`](https://explorer.arc.io/address/0x8681a05ba579704f3D165Fb874c3b61BBC68eAd7)
- Arc Testnet contract (v2): [`0x6103ac5a11f639a66b3d25bc9da918c4c714e54d`](https://explorer.testnet.arc.io/address/0x6103ac5a11f639a66b3d25bc9da918c4c714e54d)
- Example mainnet USDC deposit: https://explorer.arc.io/tx/0x76d0e59dfda7b5ee49ad2e88df80979e9f27443baaab7d339ed2f74e50f562f0

## The problem

Crypto is self-custody: if an owner dies or loses wallet access, their family usually cannot reach the funds. There is no bank to call and no password reset.

## How it works

Each owner creates a vault inside one shared contract with a list of beneficiaries (up to 10, shares totalling 100%), a check-in period and a release delay.

1. **Create** a vault: beneficiaries, shares, check-in period, release delay.
2. **Deposit** USDC. Anyone can deposit. The owner can withdraw before the release is finalized.
3. **Check in** on any day. Any check-in restarts the full period (deadline = last check-in + period). No daily check-ins are needed.
4. If the **entire period passes with no check-in**, anyone can call `startRelease()`. This opens a pending window.
5. The owner can **cancel** by calling `checkIn()` during the window.
6. When the window ends, anyone can call `finalizeRelease()`, which records each beneficiary's share as claimable.
7. Each listed beneficiary calls `claim()` for their own share. The person who triggers start or finalize receives nothing.

Example (90-day period): check in on day 45 and the new deadline is day 135, not day 90.

## Features

- One contract for all users, with a separate vault per owner
- Custom beneficiary shares and pull-based claims, so one lost wallet cannot block the others
- Two-step release with an owner-chosen cancellable pending window (1 minute to 30 days in the contract)
- Check-in periods of 7, 14, 30, 90, 180 and 365 days, plus custom days; the short test options appear only on testnet
- "Check in soon" and "overdue" warnings, and an Add to Calendar (.ics) reminder for the deadline
- Deposit history per vault and a Vault Lookup page where beneficiaries find a vault and claim
- A required confirmation that release is final and that this is not a legal will
- The app switches between Arc Testnet and Arc Mainnet through an environment variable

## Contract properties

- No admin keys, no upgradeability, no proxy
- Reentrancy guards, and state is updated before tokens move
- Per-vault balance tracking via `vaultBalance[vaultId]`; deposits use the before/after `balanceOf` delta
- Funds are only held in USDC; they are never lent, staked or invested
- The overdue decision is made inside the contract from `block.timestamp`, not from any off-chain read

### Functions

| Function | Who | Purpose |
|---|---|---|
| `createVault(wallets, shares, interval, pendingWindow)` | Anyone | Create a vault |
| `deposit(vaultId, amount)` | Anyone | Deposit USDC |
| `checkIn(vaultId)` | Owner | Restart the timer, cancel a pending release |
| `withdraw(vaultId, amount)` | Owner | Withdraw before finalization |
| `updateBeneficiaries(vaultId, wallets, shares)` | Owner | Update shares |
| `startRelease(vaultId)` | Anyone | Start the pending window (overdue vaults only) |
| `finalizeRelease(vaultId)` | Anyone | Assign claimable shares after the window |
| `claim(vaultId)` | Beneficiary | Withdraw own share |

## Local setup

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
git clone https://github.com/Kingxfn/amanah-vault
cd amanah-vault
bun install
```

Create a `.env` file:

```
VITE_VAULT_ADDRESS=0x6103ac5a11f639a66b3d25bc9da918c4c714e54d
# For Arc Mainnet use these two lines instead:
# VITE_VAULT_ADDRESS=0x8681a05ba579704f3D165Fb874c3b61BBC68eAd7
# VITE_ARC_MAINNET=true
```

```bash
bun run dev
```

Open http://localhost:5173 and connect a wallet.

| | Arc Testnet | Arc Mainnet |
|---|---|---|
| RPC URL | https://rpc.testnet.arc.io | https://rpc.mainnet.arc.io |
| Chain ID | 5042002 | 5042 |
| Currency symbol | USDC | USDC |
| Explorer | https://explorer.testnet.arc.io | https://explorer.arc.io |
| USDC (ERC-20) | 0x3600000000000000000000000000000000000000 | 0x3600000000000000000000000000000000000000 |

Testnet USDC: use "Get test USDC" in Arc Studio or the Arc faucet.

## Tests

```bash
cd contracts
forge test -vv
```

The suite covers happy paths, revert paths, multi-vault isolation, dust distribution, fuzz tests, the post-release invariant and the start/finalize/cancel flows.

## Deployment

The v2 contract is deployed to both networks (addresses above). The mainnet deployment was made from my own wallet with Remix and MetaMask, because Arc Studio cannot sign mainnet transactions. To redeploy with Foundry:

```bash
# import your key (never pass --private-key on the command line)
cast wallet import deployer --interactive

forge create contracts/AmanahVault.sol:AmanahVault \
  --rpc-url <RPC_URL> \
  --account deployer \
  --constructor-args 0x3600000000000000000000000000000000000000
```

Then set `VITE_VAULT_ADDRESS` (and `VITE_ARC_MAINNET=true` for mainnet) and redeploy the app. Vite reads these values at build time.

## Safety notices

- **Unaudited. Use small amounts.**
- Not a legal will.
- This contract holds real funds. Review the source before depositing.

## Limitations

- **Sliding-window deadline.** The deadline is `lastCheckIn + interval`. The owner can still check in after the deadline until `startRelease()` is called, and a check-in during the pending window cancels the release.
- **Finalize is final.** After `finalizeRelease()` the balance is allocated to beneficiaries and cannot be reversed. The owner cannot withdraw after that.
- **Death and lost access look the same.** The contract only sees a missed check-in.
- **Interval is fixed at creation.** The contract accepts any interval; the app hides short options on mainnet (shortest is 1 day), so the full release flow takes at least two days there.
- **Unclaimed funds.** There is no timeout for unclaimed shares. A lost beneficiary wallet locks only that share.
- **Public data.** Balances and addresses are visible on-chain.

## Roadmap

Not yet implemented:

- A note or contact so beneficiaries find out a vault exists
- A guardian who can veto a release
- A backup beneficiary for unclaimed shares
- Updating the check-in interval on an active vault
- Reminders beyond the calendar file, and an "unavailable" state when a read fails
- An independent security audit

## Built with Arc Studio

The contract, tests and React app were written and tested in Arc Studio. Arc Studio project: https://studio.arc.io/app/bd29f1c7-8731-4898-be07-af8ae4816e5a
