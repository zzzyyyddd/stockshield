"use client";

type SafetyLevel = "PASS" | "CAUTION" | "BLOCK";

type SafetyItem = {
  label: string;
  status: SafetyLevel;
  message: string;
};

type TradeSafetyCheckProps = {
  walletConnected: boolean;
  bnbBalance: number;
  marketStatus: string;
  deviation: number;
  liquidity: number;
  slippage: number;
  priceImpact: number;
};

export default function TradeSafetyCheck({
  walletConnected,
  bnbBalance,
  marketStatus,
  deviation,
  liquidity,
  slippage,
  priceImpact,
}: TradeSafetyCheckProps) {
  const checks: SafetyItem[] = [];

  checks.push({
    label: "Wallet",
    status: walletConnected ? "PASS" : "BLOCK",
    message: walletConnected
      ? "Wallet connected"
      : "Connect a wallet before trading",
  });

  checks.push({
    label: "Gas balance",
    status:
      !walletConnected
        ? "BLOCK"
        : bnbBalance <= 0
          ? "BLOCK"
          : bnbBalance < 0.0005
            ? "CAUTION"
            : "PASS",
    message:
      !walletConnected
        ? "Wallet balance unavailable"
        : bnbBalance <= 0
          ? "No BNB available for network gas"
          : bnbBalance < 0.0005
            ? "BNB gas balance is very low"
            : "BNB available for network gas",
  });

  checks.push({
    label: "Market",
    status: marketStatus === "OPEN" ? "PASS" : "CAUTION",
    message:
      marketStatus === "OPEN"
        ? "Underlying market is open"
        : "Underlying market is closed",
  });

  checks.push({
    label: "Price deviation",
    status:
      deviation >= 3
        ? "BLOCK"
        : deviation >= 1
          ? "CAUTION"
          : "PASS",
    message:
      deviation >= 3
        ? `${deviation.toFixed(2)}% deviation is unusually high`
        : deviation >= 1
          ? `${deviation.toFixed(2)}% deviation needs attention`
          : `${deviation.toFixed(2)}% deviation`,
  });

  checks.push({
    label: "Liquidity",
    status:
      liquidity < 100_000
        ? "BLOCK"
        : liquidity < 500_000
          ? "CAUTION"
          : "PASS",
    message:
      liquidity < 100_000
        ? "Liquidity is very low"
        : liquidity < 500_000
          ? "Liquidity is limited"
          : "Liquidity is healthy",
  });

  checks.push({
    label: "Slippage",
    status:
      slippage >= 3
        ? "BLOCK"
        : slippage >= 1
          ? "CAUTION"
          : "PASS",
    message:
      slippage >= 3
        ? `${slippage.toFixed(2)}% estimated slippage is high`
        : slippage >= 1
          ? `${slippage.toFixed(2)}% estimated slippage needs attention`
          : `${slippage.toFixed(2)}% estimated slippage`,
  });

  checks.push({
    label: "Price impact",
    status:
      priceImpact >= 3
        ? "BLOCK"
        : priceImpact >= 1
          ? "CAUTION"
          : "PASS",
    message:
      priceImpact >= 3
        ? `${priceImpact.toFixed(2)}% price impact is high`
        : priceImpact >= 1
          ? `${priceImpact.toFixed(2)}% price impact needs attention`
          : `${priceImpact.toFixed(2)}% price impact`,
  });

  const hasBlock = checks.some((check) => check.status === "BLOCK");
  const hasCaution = checks.some((check) => check.status === "CAUTION");

  const overallStatus: SafetyLevel = hasBlock
    ? "BLOCK"
    : hasCaution
      ? "CAUTION"
      : "PASS";

  const overallText =
    overallStatus === "PASS"
      ? "Checks passed"
      : overallStatus === "CAUTION"
        ? "Review before trading"
        : "Trade blocked by safety checks";

  const overallClass =
    overallStatus === "PASS"
      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
      : overallStatus === "CAUTION"
        ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300"
        : "border-red-400/20 bg-red-400/[0.06] text-red-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Pre-trade safety
          </div>

          <div className="mt-2 text-lg font-bold">
            {overallText}
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs font-bold ${overallClass}`}
        >
          {overallStatus}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0"
          >
            <div>
              <div className="text-sm font-medium text-zinc-200">
                {check.label}
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                {check.message}
              </div>
            </div>

            <StatusBadge status={check.status} />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-500">
        StockShield uses transparent heuristic thresholds for this MVP.
        These checks provide execution context and do not guarantee trade
        outcomes.
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SafetyLevel }) {
  const className =
    status === "PASS"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "CAUTION"
        ? "bg-amber-400/10 text-amber-300"
        : "bg-red-400/10 text-red-300";

  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${className}`}
    >
      {status}
    </span>
  );
}