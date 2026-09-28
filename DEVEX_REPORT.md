# StockShield — Developer Experience Report

## BNB Hack: Tokenized Stocks Edition

### Project

**StockShield — Know before you trade.**

StockShield is a pre-trade safety and execution-readiness assistant for tokenized stocks on BNB Chain.

This report documents the actual developer experience of building the StockShield hackathon MVP, including onboarding, integrations, errors, workarounds, and feedback for the BNB Chain, Binance Web3, and PancakeSwap developer ecosystem.

---

## 1. Development Goal

The goal was to build a workflow that could inspect a tokenized-stock trade before asking the user to sign it.

The intended flow became:

**Market Context → Live Quote → Wallet Preflight → Safety Engine → Universal Router Simulation → Execution Readiness**

For the MVP, we focused the fully validated on-chain route on **NVDAB / USDT on BNB Chain**.

A major design principle was that unavailable or fallback information should never silently influence the safety result.

---

## 2. Development Environment

The project was built with:

- Next.js
- React
- TypeScript
- Tailwind CSS
- viem
- BNB Chain
- Binance Web3 API
- PancakeSwap V3
- PancakeSwap Smart Router SDK
- PancakeSwap Universal Router SDK
- Permit2
- MetaMask
- Vercel

The development machine used Windows and PowerShell.

The application was deployed continuously through GitHub and Vercel.

---

## 3. Binance Web3 RWA API Experience

### Initial Integration

The first goal was to retrieve tokenized-stock information through the Binance Web3 RWA API.

Implementing the request signing was not immediately straightforward.

The first signed request returned:

`40102 Invalid signature`

The important discovery was that the signed request path needed to include the `/build` prefix even though the API endpoint itself was:

`/api/v1/dex/market/rwa/search`

After correcting the signed path, authentication progressed successfully past the signature error.

### Compliance Response

The correctly signed request then returned:

`40304 Service not available due to compliance restriction`

This became an important product-design decision.

Instead of attempting to bypass the restriction, StockShield implemented a transparent fallback mode.

When live RWA data cannot be obtained:

- the UI identifies the fallback state
- demo market/reference data can still demonstrate the workflow
- fallback market data is excluded from the safety score
- the upstream error/reason can be preserved for debugging

This made the application usable as a hackathon demonstration without presenting fallback data as live data.

### Local vs Hosted Networking

Another unexpected issue was that some Binance-related network requests timed out from the local development environment while the same integration could be reached from the Vercel deployment environment.

This made it useful to test integrations in both environments instead of assuming that a local networking failure meant that the API implementation itself was incorrect.

### Feedback

API signing documentation would benefit from an explicit, copyable example showing:

- endpoint path
- signed path
- exact pre-hash string
- timestamp format
- query-string ordering
- expected signature output

It would also be useful if compliance-related responses were documented separately from authentication errors so developers can quickly distinguish a bad implementation from unavailable service access.

---

## 4. BNB Chain RPC Experience

During development, the initially tested Binance BSC RPC endpoint timed out from the local environment.

An alternative public BNB Chain RPC endpoint worked successfully and allowed development to continue.

This reinforced the need for RPC redundancy in production applications.

### Feedback

Developer documentation and starter templates could encourage applications to configure multiple RPC providers rather than relying on a single endpoint.

This would improve onboarding when a developer encounters ISP, routing, rate-limit, or provider-specific availability issues.

---

## 5. PancakeSwap V3 Pool Discovery

StockShield needed a real NVDAB/USDT liquidity source rather than a mocked DEX route.

We queried PancakeSwap V3 pools across multiple fee tiers.

The discovered pools included fee tiers of:

- 0.01%
- 0.05%
- 0.25%
- 1%

The 0.25% NVDAB/USDT pool was selected for the MVP route.

An important lesson was that the raw V3 `liquidity()` value should not be presented directly as dollar TVL.

It represents concentrated-liquidity state and requires additional interpretation.

StockShield therefore avoids pretending that this raw value is a USD liquidity figure.

---

## 6. PancakeSwap QuoterV2 Experience

QuoterV2 became one of the cleanest parts of the integration.

Using viem `simulateContract`, StockShield could obtain a real NVDAB output quote without:

- wallet interaction
- token approval
- signature
- transaction submission

This was a good fit for a pre-trade safety product.

The quote pipeline eventually separated:

- pool fee
- market impact
- effective execution difference

This distinction was important.

An earlier implementation effectively mixed fee and market impact together. The calculation was corrected so the safety engine could reason about live market impact independently.

### Feedback

Read-only quote examples using viem would be especially useful in PancakeSwap documentation because they provide a simple path for developers who do not yet need full transaction execution.

---

## 7. Universal Router SDK Integration

Universal Router integration was the most technically challenging part of the project.

Several TypeScript and SDK compatibility issues appeared during implementation.

Examples included:

- trade-type incompatibility
- V3 SDK `Trade` not matching the Smart Router trade type
- V3 SDK `Pool` not matching the Smart Router `V3Pool` type
- enum/literal type widening
- BigInt JSON serialization

These were solved incrementally by using the types expected by the Smart Router and Universal Router packages and by explicitly converting BigInt values before JSON serialization.

### Developer Experience Observation

The individual PancakeSwap packages are powerful, but understanding which package owns each compatible type requires significant exploration.

The ecosystem includes concepts with similar names across packages, while TypeScript correctly treats them as different types.

### Feedback

A single official end-to-end TypeScript example covering:

**V3 pool state → Smart Router trade → Universal Router calldata**

would significantly reduce integration time.

Ideally, the example would use one consistent set of imports and types from beginning to end.

---

## 8. Universal Router Address Verification

Before using Universal Router, we verified the BNB Chain router address through the SDK and checked that bytecode was deployed at the returned address.

This was useful because router addresses are security-sensitive configuration.

The verified BNB Chain Universal Router used by the MVP is:

`0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB`

This verification step became part of our development discipline: do not rely on an address until the chain confirms that a contract is actually deployed there.

---

## 9. Permit2 Integration

Permit2 introduced an important distinction between two authorization layers:

1. ERC-20 allowance from USDT to Permit2
2. Permit2 allowance from Permit2 to Universal Router

During testing, the connected wallet already had a large historical ERC-20 allowance to Permit2 because it had previously interacted with PancakeSwap.

However, the Permit2 authorization for Universal Router was expired.

This was not immediately obvious until Universal Router simulation was added.

The simulation reverted with selector:

`0xd81b2f2e`

This was identified as the Permit2:

`AllowanceExpired(uint256)`

error.

That was a valuable result because the simulation exposed the exact wallet-state dependency before any real swap was submitted.

StockShield now classifies this state as:

`PERMIT2_AUTHORIZATION_EXPIRED`

---

## 10. Permit2 Authorization Safety

The authorization flow was intentionally designed to avoid unlimited approvals.

StockShield prepares authorization with:

- exact trade amount
- Universal Router as spender
- one-hour expiration

Before sending the authorization request, the application checks:

- connected address
- active MetaMask account
- BNB Smart Chain network
- USDT balance
- minimum BNB gas reserve

After the authorization transaction is submitted, StockShield:

1. waits for the transaction receipt
2. checks that the receipt succeeded
3. reads the Permit2 allowance again
4. verifies the amount
5. verifies that the expiration is still in the future

Only then can the wallet preflight become ready.

---

## 11. Read-Only Execution Simulation

A major milestone was building the final Universal Router calldata without actually executing it.

StockShield performs an `eth_call` against the Universal Router using the connected wallet address as the simulated sender.

The simulation does not:

- request a signature
- request an approval
- submit a swap transaction

It can classify the prepared execution as:

- `SIMULATABLE`
- `BLOCKED_BY_WALLET_STATE`
- `PERMIT2_AUTHORIZATION_EXPIRED`
- `FAILED`

This became one of the most useful features of the project.

A route can be valid while the wallet is not ready. StockShield can now show that distinction before execution.

---

## 12. Safety Engine Evolution

The safety engine changed substantially during development.

Initially, it was tempting to treat all displayed information as equivalent.

That would have been misleading.

The final approach distinguishes between:

- live information
- fallback information
- unavailable information
- MVP estimates

Checks can return:

- `PASS`
- `CAUTION`
- `BLOCK`
- `NOT SCORED`

Demo fallback market/reference/liquidity data is excluded from scoring.

The MVP slippage estimate is also excluded from scoring.

Live on-chain market impact is scored.

Execution readiness requires:

- wallet connected
- BNB Smart Chain selected
- wallet preflight ready
- Universal Router simulation equal to `SIMULATABLE`

This makes the safety result explainable instead of opaque.

---

## 13. Wallet-State Lessons

Wallet state introduced several edge cases.

One issue was that periodic wallet refreshes could accidentally reset a completed simulation.

Another issue was stale execution-preview state when:

- the selected stock changed
- the trade amount changed
- a new pre-trade check started

The UI was updated so stale previews are cleared when trade parameters change.

We also added an active-account guard so the account currently selected in the wallet must match the account StockShield believes is connected.

This reduces the risk of preparing authorization for one account while another wallet account is active.

---

## 14. Gas Readiness

A wallet can have a valid token balance but still be unable to authorize or trade because it lacks BNB for gas.

StockShield therefore checks BNB balance separately.

For the authorization flow, a conservative minimum BNB reserve guard is used before requesting the on-chain Permit2 authorization.

This is intentionally treated as a guard rather than an exact gas estimate.

---

## 15. Windows and PowerShell Development Notes

The Windows development environment produced several smaller but useful lessons.

### UTF-8 File Encoding

A PowerShell file-write operation caused invalid UTF-8/mojibake in UI text during development.

The safer approach was to write files explicitly using UTF-8 without BOM.

The corrupted UI text was cleaned and a project-wide scan confirmed that the known mojibake patterns were gone.

### Line Endings

Git regularly reports:

`LF will be replaced by CRLF`

in the Windows working copy.

This is expected line-ending behavior and did not affect the production build.

### PowerShell String Replacement

Some automated text edits were more fragile than expected.

For example, the available PowerShell `.Replace()` overload did not support a replacement-count argument.

For sensitive code changes, precise inspection and targeted replacements were safer than broad automated replacements.

---

## 16. Build and Deployment Experience

Next.js production builds were used repeatedly as safety checkpoints.

After major changes we ran:

`npm run build`

This caught TypeScript and integration errors before pushing.

GitHub was used as the source repository and Vercel automatically deployed the `main` branch.

This workflow made it easy to separate:

- local machine/network issues
- compilation problems
- hosted runtime behavior
- upstream API availability

---

## 17. What Worked Well

Several parts of the ecosystem worked particularly well for this project.

### BNB Chain

BNB Chain provided the live environment needed to test tokenized-stock liquidity and wallet state without inventing a synthetic blockchain environment.

### viem

viem was effective for:

- contract reads
- wallet clients
- transaction receipt handling
- contract simulation
- raw `eth_call`
- BNB balance checks

### PancakeSwap QuoterV2

QuoterV2 provided a strong read-only primitive for pre-trade analysis.

### Universal Router Simulation

Once calldata construction was working, simulating the final router call provided valuable information about wallet readiness.

### Vercel

Hosted deployment was useful not only for presentation but also for diagnosing differences between local and hosted network access.

---

## 18. Main Friction Points

The largest development friction came from:

1. Binance Web3 request-signing details
2. compliance availability being discovered only after authentication succeeded
3. RPC availability differences between local and hosted environments
4. identifying compatible types across PancakeSwap SDK packages
5. understanding the two-layer Permit2 allowance model
6. finding the correct Universal Router spender relationship
7. distinguishing route validity from wallet readiness

None of these prevented the MVP from being built, but clearer end-to-end documentation could reduce the time needed to connect all the pieces.

---

## 19. Suggested Developer Experience Improvements

### Binance Web3

Provide complete signed-request examples for each authentication style, including the exact pre-hash string.

Clearly document compliance/unavailable-service errors separately from authentication errors.

### BNB Chain

Encourage RPC fallback configuration in starter applications.

Provide tokenized-stock examples that combine market data and on-chain state.

### PancakeSwap

Provide one canonical TypeScript example for:

**token input → V3 pool → quote → Smart Router trade → Permit2 → Universal Router calldata → simulation**

Use mutually compatible SDK types throughout the example.

Explain the difference between:

- ERC-20 → Permit2 allowance
- Permit2 → Universal Router allowance

Include common Universal Router simulation reverts and their decoded meanings.

---

## 20. Final Developer Takeaway

The most important lesson from building StockShield was that **a valid quote is not the same thing as an executable trade**.

A trade can have:

- a real liquidity pool
- a valid quote
- reasonable market impact
- correctly constructed calldata

and still fail because the wallet is not ready.

By combining market context, on-chain quote data, wallet authorization state, and final router simulation, StockShield can explain that difference before the user attempts execution.

That became the core idea of the project:

> **Know before you trade.**

---

## Current MVP Status

The current MVP demonstrates:

- tokenized-stock market context
- transparent fallback handling
- live NVDAB/USDT PancakeSwap V3 quotes
- live market-impact analysis
- wallet and gas preflight
- ERC-20 and Permit2 allowance inspection
- guarded Permit2 authorization
- Universal Router calldata generation
- read-only Universal Router simulation
- transparent safety scoring
- final execution-readiness gating

The final swap submission remains intentionally disabled in the hackathon MVP.