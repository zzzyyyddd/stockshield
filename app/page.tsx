"use client";

import { useEffect, useState } from "react";
import WalletButton, { type WalletState } from "./WalletButton";
import TradeSafetyCheck from "./TradeSafetyCheck";

type Stock = {
  symbol: string;
  name: string;
  token: string;
  provider: string;
  price: number;
  reference: number;
  gap: number;
  liquidity: number;
  slippage: number;
  impact: number;
  market: string;
  risk: string;
};

const demoStocks: Stock[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "NVDAx",
    provider: "Tokenized Stock",
    price: 184.8,
    reference: 183.9,
    gap: 0.49,
    liquidity: 1_240_000,
    slippage: 0.18,
    impact: 0.12,
    market: "CLOSED",
    risk: "MEDIUM",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "TSLAx",
    provider: "Tokenized Stock",
    price: 421.2,
    reference: 420.81,
    gap: 0.09,
    liquidity: 980_000,
    slippage: 0.11,
    impact: 0.08,
    market: "CLOSED",
    risk: "LOW",
  },
  {
    symbol: "AAPL",
    name: "Apple",
    token: "AAPLx",
    provider: "Tokenized Stock",
    price: 291.42,
    reference: 290.95,
    gap: 0.16,
    liquidity: 1_510_000,
    slippage: 0.09,
    impact: 0.06,
    market: "CLOSED",
    risk: "LOW",
  },
];

type ApiStatus = "checking" | "connected" | "fallback";

type ApiStock = {
  symbol?: string;
  name?: string;
  price?: number;
  referencePrice?: number;
  deviation?: number;
  liquidity?: number;
  marketStatus?: string;
};

const emptyWallet: WalletState = {
  connected: false,
  address: null,
  bnbBalance: 0,
  chainId: null,
};

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>(demoStocks);
  const [selected, setSelected] = useState<Stock>(demoStocks[0]);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("20");
  const [simulated, setSimulated] = useState(false);
  const [apiStatus, setApiStatus] =
    useState<ApiStatus>("checking");
  const [wallet, setWallet] =
    useState<WalletState>(emptyWallet);

  useEffect(() => {
    let active = true;

    async function loadStockData() {
      try {
        const response = await fetch("/api/rwa", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!active) return;

        if (!response.ok || result?.success === false) {
          setApiStatus("fallback");
          return;
        }

        setApiStatus(
          result?.mode === "live"
            ? "connected"
            : "fallback",
        );

        if (!Array.isArray(result?.data)) {
          return;
        }

        const mappedStocks: Stock[] = result.data
          .filter(
            (item: ApiStock) =>
              item &&
              typeof item.symbol === "string" &&
              typeof item.name === "string" &&
              typeof item.price === "number",
          )
          .map((item: ApiStock) => {
            const original = demoStocks.find(
              (stock) => stock.symbol === item.symbol,
            );

            return {
              symbol: item.symbol!,
              name: item.name!,
              token:
                original?.token ??
                `${item.symbol}x`,
              provider:
                original?.provider ??
                "Tokenized Stock",
              price: item.price!,
              reference:
                item.referencePrice ??
                original?.reference ??
                item.price!,
              gap:
                item.deviation ??
                original?.gap ??
                0,
              liquidity:
                item.liquidity ??
                original?.liquidity ??
                0,
              slippage:
                original?.slippage ?? 0,
              impact:
                original?.impact ?? 0,
              market:
                item.marketStatus ??
                original?.market ??
                "UNKNOWN",
              risk:
                original?.risk ?? "UNKNOWN",
            };
          });

        if (mappedStocks.length > 0) {
          setStocks(mappedStocks);
          setSelected(mappedStocks[0]);
        }
      } catch {
        if (active) {
          setApiStatus("fallback");
        }
      }
    }

    void loadStockData();

    return () => {
      active = false;
    };
  }, []);

  const filtered = stocks.filter(
    (stock) =>
      stock.symbol
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      stock.name
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const receive =
    Number(amount || 0) > 0
      ? (
          Number(amount) /
          selected.price
        ).toFixed(6)
      : "0.000000";

  const correctNetwork =
    wallet.chainId === 56;

  function handleWalletChange(
    nextWallet: WalletState,
  ) {
    setWallet(nextWallet);
    setSimulated(false);
  }

  function handleSimulate() {
    setSimulated(true);
  }

  function formatLiquidity(value: number) {
    if (value >= 1_000_000) {
      return `$${(
        value / 1_000_000
      ).toFixed(2)}M`;
    }

    if (value >= 1_000) {
      return `$${(
        value / 1_000
      ).toFixed(0)}K`;
    }

    return `$${value.toFixed(0)}`;
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <nav className="border-b border-white/10 bg-[#090c12]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-xl font-black text-black">
              S
            </div>

            <div>
              <div className="text-lg font-bold tracking-tight">
                StockShield
              </div>
              <div className="text-xs text-zinc-500">
                Tokenized Stock Safety Layer
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <button className="text-white">
              Discover
            </button>
            <button>Check</button>
            <button>Portfolio</button>
          </div>

          <WalletButton
            onWalletChange={handleWalletChange}
          />
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Built for tokenized stocks on BNB Chain
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Know before
            <span className="text-emerald-400">
              {" "}
              you trade.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
            Check price deviation, market status,
            liquidity, slippage and transaction risk
            before trading tokenized stocks on-chain.
          </p>

          <div className="mt-5">
            {apiStatus === "checking" && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                Checking Binance Web3 API...
              </div>
            )}

            {apiStatus === "connected" && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                LIVE · Binance Web3 API
              </div>
            )}

            {apiStatus === "fallback" && (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-3 py-1.5 text-xs font-medium text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                DEMO · Binance RWA API unavailable in
                this environment
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.5fr]">
          <div className="rounded-3xl border border-white/10 bg-[#0d1118] p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold">
                Discover stocks
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                Search supported tokenized equities
              </div>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search NVDA, TSLA, AAPL..."
              className="mb-5 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />

            <div className="space-y-2">
              {filtered.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => {
                    setSelected(stock);
                    setSimulated(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    selected.symbol ===
                    stock.symbol
                      ? "border-emerald-400/40 bg-emerald-400/10"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {stock.symbol.slice(0, 2)}
                    </div>

                    <div>
                      <div className="font-semibold">
                        {stock.symbol}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {stock.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium">
                      ${stock.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-emerald-400">
                      +
                      {stock.gap.toFixed(2)}% gap
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1118] p-6 md:p-8">
            <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-center">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-3xl font-bold">
                    {selected.symbol}
                  </h2>

                  <span className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-300">
                    {selected.token}
                  </span>
                </div>

                <div className="text-sm text-zinc-500">
                  {selected.name} ·{" "}
                  {selected.provider}
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="text-3xl font-semibold">
                  ${selected.price.toFixed(2)}
                </div>

                <div className="mt-1 text-xs text-zinc-500">
                  {apiStatus === "connected"
                    ? "Live on-chain price"
                    : "Demo on-chain price"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Reference price"
                value={`$${selected.reference.toFixed(
                  2,
                )}`}
              />

              <Metric
                label="Price deviation"
                value={`+${selected.gap.toFixed(
                  2,
                )}%`}
              />

              <Metric
                label="Liquidity"
                value={formatLiquidity(
                  selected.liquidity,
                )}
              />

              <Metric
                label="Market"
                value={selected.market}
                warning={
                  selected.market !== "OPEN"
                }
              />
            </div>

            {selected.market !== "OPEN" && (
              <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
                <div className="flex gap-3">
                  <div className="text-xl">⚠</div>

                  <div>
                    <div className="font-semibold text-amber-200">
                      Underlying market is closed
                    </div>

                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      The token can continue trading
                      on-chain while the underlying
                      market is closed. Reference
                      pricing may be less current until
                      the market reopens.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Trade check
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold">
                      {selected.risk}
                    </div>

                    <div className="mt-1 text-xs text-zinc-500">
                      Current execution risk
                    </div>
                  </div>

                  <div className="h-3 w-28 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <Row
                    label="Estimated slippage"
                    value={`${selected.slippage.toFixed(
                      2,
                    )}%`}
                  />

                  <Row
                    label="Price impact"
                    value={`${selected.impact.toFixed(
                      2,
                    )}%`}
                  />

                  <Row
                    label="Network"
                    value="BNB Smart Chain"
                  />

                  <Row
                    label="Wallet"
                    value={
                      wallet.connected
                        ? "Connected"
                        : "Not connected"
                    }
                  />

                  <Row
                    label="Gas balance"
                    value={
                      wallet.connected
                        ? `${wallet.bnbBalance.toFixed(
                            6,
                          )} BNB`
                        : "Unavailable"
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Simulate buy
                </div>

                <div className="mt-4 flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-4">
                  <span className="text-zinc-500">
                    $
                  </span>

                  <input
                    value={amount}
                    onChange={(event) => {
                      setAmount(
                        event.target.value,
                      );
                      setSimulated(false);
                    }}
                    type="number"
                    min="0"
                    className="w-full bg-transparent px-2 py-3 text-lg font-semibold outline-none"
                  />

                  <span className="text-sm text-zinc-400">
                    USDT
                  </span>
                </div>

                {!wallet.connected && (
                  <div className="mt-3 text-xs text-amber-300">
                    Connect MetaMask before running
                    the complete wallet safety check.
                  </div>
                )}

                {wallet.connected &&
                  !correctNetwork && (
                    <div className="mt-3 text-xs text-red-300">
                      Switch MetaMask to BNB Smart
                      Chain before continuing.
                    </div>
                  )}

                <button
                  onClick={handleSimulate}
                  className="mt-3 w-full rounded-xl bg-emerald-400 py-3 font-bold text-black transition hover:bg-emerald-300"
                >
                  Run Pre-Trade Check
                </button>

                {simulated && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="mb-3 text-sm font-semibold text-zinc-200">
                      Transaction preview
                    </div>

                    <div className="space-y-2 text-sm">
                      <Row
                        label="You pay"
                        value={`$${
                          amount || "0"
                        } USDT`}
                      />

                      <Row
                        label="Estimated receive"
                        value={`${receive} ${selected.token}`}
                      />

                      <Row
                        label="Slippage"
                        value={`${selected.slippage.toFixed(
                          2,
                        )}%`}
                      />

                      <Row
                        label="Price impact"
                        value={`${selected.impact.toFixed(
                          2,
                        )}%`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {simulated && (
              <div className="mt-6">
                <TradeSafetyCheck
                  walletConnected={
                    wallet.connected &&
                    correctNetwork
                  }
                  bnbBalance={
                    wallet.bnbBalance
                  }
                  marketStatus={
                    selected.market
                  }
                  deviation={selected.gap}
                  liquidity={
                    selected.liquidity
                  }
                  slippage={
                    selected.slippage
                  }
                  priceImpact={
                    selected.impact
                  }
                />

                <button
                  type="button"
                  disabled
                  className="mt-4 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/70 py-3 font-bold text-black opacity-70"
                >
                  Execute Trade · Disabled in MVP
                </button>

                <div className="mt-2 text-center text-xs text-zinc-600">
                  No transaction will be submitted
                  and no token approval will be
                  requested.
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-xs text-zinc-600">
              StockShield MVP · Data mode is
              reported transparently by the
              StockShield API
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
      <div className="text-xs text-zinc-500">
        {label}
      </div>

      <div
        className={`mt-2 font-semibold ${
          warning
            ? "text-amber-300"
            : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">
        {label}
      </span>

      <span className="text-right font-medium text-zinc-200">
        {value}
      </span>
    </div>
  );
}