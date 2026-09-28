# StockShield

> **Know before you trade.**

StockShield is a pre-trade safety and execution-readiness assistant for tokenized stocks on BNB Chain.

It helps users inspect a tokenized-stock trade before signing anything by combining market context, live on-chain quotes, wallet readiness checks, execution simulation, and transparent safety rules in one interface.

## Live Demo

https://stockshield-drab.vercel.app

## The Problem

Trading tokenized stocks on-chain requires users to understand several things before signing a transaction:

- Is the wallet connected to the correct network?
- Is there enough BNB for gas?
- Is the underlying market open or closed?
- Is the token price deviating from its reference price?
- What does the live DEX route look like?
- What is the estimated market impact?
- Are token and router authorizations ready?
- Would the prepared swap call succeed before the user signs it?

These checks are usually fragmented across wallets, explorers, market-data services, and DEX interfaces.

## The Solution

StockShield brings those checks into one pre-trade workflow:

**Market Context → Live Quote → Wallet Preflight → Safety Engine → Execution Simulation → Execution Readiness**

The goal is simple:

**Make the trade state understandable before asking the user to sign.**

## Current MVP

The current MVP focuses on **NVDAB / USDT on BNB Chain**.

### 1. Market Context

StockShield integrates with the Binance Web3 RWA API to retrieve tokenized-stock market and reference information.

The interface can display:

- tokenized-stock price
- reference price
- price deviation
- underlying market status
- liquidity context

If the upstream RWA service is unavailable because of API or regional/compliance restrictions, StockShield explicitly switches to **demo fallback data**.

Fallback data is clearly identified and is **excluded from the safety score**.

### 2. Live On-Chain Quote

For NVDAB, StockShield retrieves a live read-only quote from PancakeSwap V3 on BNB Chain.

The quote includes:

- expected NVDAB output
- PancakeSwap pool fee
- live market impact
- effective execution information
- current BNB Chain state

The quote is obtained through a read-only QuoterV2 simulation.

No wallet signature or transaction is required.

### 3. Wallet Preflight

Before execution can be considered ready, StockShield checks:

- wallet connection
- active wallet account
- BNB Smart Chain network
- BNB gas balance
- USDT balance
- USDT allowance to Permit2
- Permit2 allowance to PancakeSwap Universal Router
- Permit2 authorization expiration

An active-account mismatch blocks authorization.

### 4. Permit2 Authorization

If router authorization is required, StockShield prepares a narrowly scoped Permit2 authorization:

- **Token:** USDT
- **Spender:** PancakeSwap Universal Router
- **Amount:** exact trade amount
- **Expiration:** 1 hour

The user remains in control and must approve the authorization through their wallet.

After submission, StockShield waits for the transaction receipt and verifies the resulting authorization on-chain.

### 5. Universal Router Execution Simulation

StockShield prepares PancakeSwap Universal Router calldata for the proposed trade and performs a read-only `eth_call` simulation before execution.

The preview includes:

- exact input amount
- expected output
- minimum received
- maximum slippage
- execution deadline
- Universal Router calldata
- simulation result

Possible simulation states include:

- `SIMULATABLE`
- `BLOCKED_BY_WALLET_STATE`
- `PERMIT2_AUTHORIZATION_EXPIRED`
- `FAILED`

This separates route validity from wallet readiness.

## Safety Engine

StockShield uses transparent heuristic checks instead of hiding the decision behind a single opaque risk score.

Checks currently include:

- execution readiness
- wallet connection
- BNB gas balance
- underlying market status
- reference-price deviation
- liquidity
- estimated slippage
- live market impact

Each scored check can return:

- `PASS`
- `CAUTION`
- `BLOCK`

Information that cannot responsibly influence the result is displayed as:

- `NOT SCORED`

### Scoring Rules

Demo fallback market, reference, and liquidity information is not included in the safety score.

The current MVP slippage estimate is displayed for context but is also marked `NOT SCORED`.

Live on-chain market impact is scored.

Execution readiness requires all of the following:

1. wallet connected
2. BNB Smart Chain selected
3. wallet preflight ready
4. Universal Router simulation status is `SIMULATABLE`

## Execution Safety

The current hackathon MVP intentionally keeps the final **Execute Trade** action disabled.

StockShield demonstrates the complete pre-trade preparation and simulation pipeline without automatically submitting the final swap transaction.

The application never requests or stores private keys or seed phrases.

Users remain responsible for wallet approvals and signatures.

## Architecture

```text
User
 |
 v
StockShield UI (Next.js)
 |
 +---- Binance Web3 RWA API
 |       |
 |       +---- market/reference context
 |       +---- transparent demo fallback
 |
 +---- BNB Chain RPC
 |       |
 |       +---- wallet/token state
 |       +---- Permit2 allowance
 |       +---- PancakeSwap V3 pool state
 |
 +---- PancakeSwap QuoterV2
 |       |
 |       +---- live NVDAB/USDT quote
 |
 +---- PancakeSwap Universal Router
         |
         +---- calldata preparation
         +---- read-only execution simulation
```

## BNB Chain Integration

Current network:

- **BNB Smart Chain**
- **Chain ID:** `56`

### Tokens

**NVDAB**

`0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436`

**USDT**

`0x55d398326f99059fF775485246999027B3197955`

### PancakeSwap Infrastructure

StockShield uses:

- PancakeSwap V3
- QuoterV2
- Permit2
- Universal Router

Live BNB Chain state is used for quote, wallet-preflight, and execution-readiness checks.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- viem
- BNB Chain
- PancakeSwap Smart Router SDK
- PancakeSwap Universal Router SDK
- Binance Web3 API
- Vercel

## API Routes

### `/api/rwa`

Retrieves tokenized-stock market and reference context.

Supports a transparent demo fallback when the upstream Binance RWA service is unavailable.

### `/api/quote`

Returns a live read-only PancakeSwap V3 quote for NVDAB/USDT.

### `/api/swap-preview`

Builds Universal Router calldata and performs a read-only execution simulation.

It does not request a wallet signature and does not submit a swap transaction.

## Run Locally

### 1. Clone

```bash
git clone https://github.com/zzzyyyddd/stockshield.git
cd stockshield
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file:

```text
BINANCE_WEB3_API_KEY=your_api_key
BINANCE_WEB3_SECRET_KEY=your_secret_key
```

These credentials must remain server-side.

Do **not** expose them using `NEXT_PUBLIC_`.

StockShield can still demonstrate its fallback RWA flow when live RWA service access is unavailable.

### 4. Start development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Production build

```bash
npm run build
```

## Current Limitations

StockShield is currently a hackathon MVP.

Known limitations:

- the fully validated live route currently focuses on NVDAB/USDT
- final swap submission is intentionally disabled
- some RWA reference information can fall back to clearly labeled demo data when the upstream service is unavailable
- the MVP slippage estimate is displayed but excluded from safety scoring
- authorization and eventual execution require sufficient USDT and BNB in the connected wallet

These limitations are surfaced rather than hidden from the user.

## Security Principles

StockShield follows several simple rules:

- never request private keys or seed phrases
- keep API credentials server-side
- never silently bypass unavailable or restricted upstream services
- clearly distinguish live data from fallback data
- exclude unavailable or fallback information from safety scoring
- simulate execution before a real trade
- require explicit wallet approval for on-chain authorization
- scope Permit2 authorization to the exact trade amount
- use short-lived Permit2 authorization
- keep final trade execution under user control

## Hackathon

Built for **BNB Hack: Tokenized Stocks Edition**.

StockShield explores how tokenized-stock trading can become easier to understand by adding a transparent pre-trade safety layer between market discovery and wallet execution.

## Status

**Hackathon MVP — active development**

Current pipeline:

**Market Context → Live Quote → Wallet Preflight → Safety Engine → Universal Router Simulation → Execution Readiness**

---

**StockShield — Know before you trade.**