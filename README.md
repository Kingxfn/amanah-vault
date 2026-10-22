# AmanahVault

A multi-tenant USDC dead-man's-switch vault on Arc Testnet.

Each vault owner sets a check-in period (e.g. 90 days) and a list of beneficiaries with percentage shares. The owner can check in at any point before the deadline — any single check-in restarts the full period. Only if the **entire period passes with no check-in** can anyone call `release()` — but the caller receives nothing. Funds can only be claimed by the listed beneficiaries, each of whom independently calls `claim()` for their share. One contract serves all users.

**Contract (Arc Testnet):** `0x45046EA5600dB33bAC486439A3A30C82B101016F`
**Explorer:** https://explorer.testnet.arc.io/address/0x45046EA5600dB33bAC486439A3A30C82B101016F

---

## Key properties

- Non-custodial — only the vault owner can withdraw before release
- No admin keys, no upgradeability, no proxy
- No yield, interest or lending — pure USDC custody
- Pull-claim model after release — anyone can trigger `release()`, but only listed beneficiaries can call `claim()`. The person who triggers release receives nothing.
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
VITE_VAULT_ADDRESS=0x45046EA5600dB33bAC486439A3A30C82B101016F
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

75 tests — happy paths, revert paths, multi-vault isolation, dust distribution, fuzz (256 runs), post-release invariant.

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

## License

MIT
