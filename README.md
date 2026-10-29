# AmanahVault

A multi-tenant USDC dead-man's-switch vault on Arc Testnet.

Each vault owner sets a check-in period, a release delay window, and a list of beneficiaries with percentage shares. The owner can check in at any point before the deadline — any single check-in restarts the full period. Only if the **entire period passes with no check-in** can anyone call `startRelease()`. The owner then has the release delay window to cancel by calling `checkIn()`. Once that window expires, anyone can call `finalizeRelease()` to distribute funds — but only listed beneficiaries can call `claim()`. One contract serves all users.

**Contract v2 (Arc Testnet):** `0x6103ac5a11f639a66b3d25bc9da918c4c714e54d`
**Explorer:** https://explorer.testnet.arc.io/address/0x6103ac5a11f639a66b3d25bc9da918c4c714e54d

---

## Key properties

- Non-custodial — only the vault owner can withdraw before release
- No admin keys, no upgradeability, no proxy
- No yield, interest or lending — pure USDC custody
- Two-step release: `startRelease()` begins a cancellable pending window (set per-vault at creation, 1 min–30 days); `finalizeRelease()` distributes once the window closes. The owner cancels by calling `checkIn()` during the window.
- Pull-claim model after finalization — only listed beneficiaries can call `claim()`. No caller receives funds for triggering start or finalize.
- Per-vault balance tracking via `vaultBalance[vaultId]` mapping
- Deposit uses before/after `balanceOf` delta to handle any token quirks

---

## Local setup

**Prerequisites:** [Bun](https://bun.sh) · [Foundry](https://getfoundry.sh)

```bash
git clone https://github.com/Kingxfn/amanah-vault
cd amanah-vault
bun install
```

Create a `.env` file:

```
VITE_VAULT_ADDRESS=0x6103ac5a11f639a66b3d25bc9da918c4c714e54d
# VITE_ARC_MAINNET=true   # uncomment to switch to Arc Mainnet
```

Start the dev server:

```bash
bun run dev
```

Open http://localhost:5173 — connect MetaMask on Arc Testnet:

| Field | Value |
|---|---|
| Network name | Arc Testnet |
| RPC URL | https://rpc.testnet.arc.io |
| Chain ID | 5042002 |
| Currency symbol | USDC |
| Explorer | https://explorer.testnet.arc.io |

Get testnet USDC from the **"Get test USDC"** button in Arc Studio, or from the [Arc faucet](https://faucet.arc.io).

---

## Contract tests

```bash
cd contracts
forge test -vv
```

90 tests — happy paths, revert paths, multi-vault isolation, dust distribution, fuzz (256 runs), post-release invariant, pending-window flows (start/finalize/cancel).

---

## Deployment

The contract is already deployed to Arc Testnet. To redeploy:

```bash
# import your key (never pass --private-key on the CLI)
cast wallet import deployer --interactive

# deploy
forge create contracts/AmanahVault.sol:AmanahVault \
  --rpc-url https://rpc.testnet.arc.io \
  --account deployer \
  --constructor-args 0x3600000000000000000000000000000000000000
```

Then set `VITE_VAULT_ADDRESS` in `.env` to the new address.

---

## Safety notices

- Unaudited. Use small amounts.
- Not a legal will.
- This contract holds real funds. Review the source before depositing.

---

## Limitations

- **Sliding-window deadline.** The check-in deadline is computed as `lastCheckIn + interval`. The owner can still call `checkIn()` after the deadline has passed — as long as `startRelease()` has not been called yet, a late check-in resets the timer and cancels any pending release within the window.
- **Any interval accepted.** The contract places no minimum or maximum on the check-in interval. Very short intervals (e.g. the 2-minute test option) are valid but mean the vault can become releasable almost immediately if the owner forgets to check in.
- **Finalize is final.** Once `finalizeRelease()` is called, the vault balance is allocated to beneficiaries and cannot be reversed. The owner cannot withdraw after finalization.
- **Unclaimed funds.** There is no timeout or fallback for unclaimed beneficiary shares. If a beneficiary never calls `claim()`, their share sits in the contract indefinitely.
- **Unaudited.** The contract has not been independently audited. Use small amounts.

---

## Roadmap

These features are not yet implemented:

- **Guardian veto.** A designated address that can block or delay a release during a dispute window.
- **Beneficiary note.** An optional on-chain or off-chain message the owner can attach to each beneficiary (e.g. a reference to instructions).
- **Interval update.** Allow the vault owner to change the check-in interval on an active vault (currently requires creating a new vault).
- **Backup beneficiary.** A fallback address that receives unclaimed shares if a listed beneficiary never calls `claim()` after a timeout.

---

## License

MIT
