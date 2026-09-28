"use client";

type SafetyLevel = "PASS" | "CAUTION" | "BLOCK";
type DisplayStatus = SafetyLevel | "NOT SCORED";

type SafetyItem = {
  label: string;
  status: DisplayStatus;
  message: string;
  scored: boolean;
};

type TradeSafetyCheckProps = {
  walletConnected: boolean;
  bnbBalance: number;
  marketStatus: string;
  marketDataAvailable?: boolean;
  deviation: number;
  referenceAvailable?: boolean;
  liquidity: number;
  liquidityDataAvailable?: boolean;
  slippage: number;
  priceImpact: number;
  executionReady: boolean;
};

export default function TradeSafetyCheck({
  walletConnected,
  bnbBalance,
  marketStatus,
  marketDataAvailable = true,
  deviation,
  referenceAvailable = true,
  liquidity,
  liquidityDataAvailable = true,
  slippage,
  priceImpact,
  executionReady,
}: TradeSafetyCheckProps) {
  const checks: SafetyItem[] = [];

  checks.push({
    label: "Execution readiness",
    status: executionReady ? "PASS" : "BLOCK",
    scored: true,
    message: executionReady
      ? "Wallet balance and token permissions are ready"
      : "Wallet preflight is not ready for execution",
  });

  checks.push({
    label: "Wallet connection",
    status: walletConnected ? "PASS" : "BLOCK",
    scored: true,
    message: walletConnected
      ? "Wallet connected and ready"
      : "Connect a wallet before continuing",
  });

  checks.push({
    label: "BNB gas balance",
    status: !walletConnected
      ? "BLOCK"
      : bnbBalance <= 0
        ? "BLOCK"
        : bnbBalance < 0.0005
          ? "CAUTION"
          : "PASS",
    scored: true,
    message: !walletConnected
      ? "Gas balance unavailable until wallet is connected"
      : bnbBalance <= 0
        ? "No BNB available for network gas"
        : bnbBalance < 0.0005
          ? `${bnbBalance.toFixed(6)} BNB Ã¢â‚¬â€ gas balance is very low`
          : `${bnbBalance.toFixed(6)} BNB available for gas`,
  });

  if (!marketDataAvailable) {
    checks.push({
      label: "Underlying market",
      status: "NOT SCORED",
      scored: false,
      message:
        "Live market-status data unavailable Ã¢â‚¬â€ excluded from the safety score",
    });
  } else {
    checks.push({
      label: "Underlying market",
      status:
        marketStatus === "OPEN"
          ? "PASS"
          : "CAUTION",
      scored: true,
      message:
        marketStatus === "OPEN"
          ? "Underlying market is open"
          : "Underlying market is closed Ã¢â‚¬â€ reference pricing may be less current",
    });
  }

  if (!referenceAvailable) {
    checks.push({
      label: "Reference deviation",
      status: "NOT SCORED",
      scored: false,
      message:
        "Live reference feed unavailable Ã¢â‚¬â€ excluded from the safety score",
    });
  } else {
    checks.push({
      label: "Reference deviation",
      status:
        deviation >= 3
          ? "BLOCK"
          : deviation >= 1
            ? "CAUTION"
            : "PASS",
      scored: true,
      message:
        deviation >= 3
          ? `${deviation.toFixed(2)}% deviation exceeds the 3% safety threshold`
          : deviation >= 1
            ? `${deviation.toFixed(2)}% deviation deserves additional review`
            : `${deviation.toFixed(2)}% deviation is within the MVP threshold`,
    });
  }

  if (!liquidityDataAvailable) {
    checks.push({
      label: "Liquidity",
      status: "NOT SCORED",
      scored: false,
      message:
        "Live comparable liquidity data unavailable Ã¢â‚¬â€ excluded from the safety score",
    });
  } else {
    checks.push({
      label: "Liquidity",
      status:
        liquidity < 100_000
          ? "BLOCK"
          : liquidity < 500_000
            ? "CAUTION"
            : "PASS",
      scored: true,
      message:
        liquidity < 100_000
          ? `$${formatNumber(liquidity)} liquidity is below the minimum threshold`
          : liquidity < 500_000
            ? `$${formatNumber(liquidity)} liquidity is limited`
            : `$${formatNumber(liquidity)} liquidity is within the MVP threshold`,
    });
  }

  checks.push({
    label: "Estimated slippage (MVP)",
    status:
      slippage >= 3
        ? "BLOCK"
        : slippage >= 1
          ? "CAUTION"
          : "PASS",
    scored: true,
    message:
      slippage >= 3
        ? `${slippage.toFixed(2)}% MVP slippage estimate exceeds the safety threshold`
        : slippage >= 1
          ? `${slippage.toFixed(2)}% MVP slippage estimate deserves review`
          : `${slippage.toFixed(2)}% MVP slippage estimate is within the threshold`,
  });

  checks.push({
    label: "Live market impact",
    status:
      priceImpact >= 3
        ? "BLOCK"
        : priceImpact >= 1
          ? "CAUTION"
          : "PASS",
    scored: true,
    message:
      priceImpact >= 3
        ? `${priceImpact.toFixed(2)}% live market impact exceeds the safety threshold`
        : priceImpact >= 1
          ? `${priceImpact.toFixed(2)}% live market impact deserves review`
          : `${priceImpact.toFixed(6)}% live on-chain market impact is within the threshold`,
  });

  const scoredChecks = checks.filter(
    (check) => check.scored,
  );

  const passCount = scoredChecks.filter(
    (check) => check.status === "PASS",
  ).length;

  const cautionCount = scoredChecks.filter(
    (check) => check.status === "CAUTION",
  ).length;

  const blockCount = scoredChecks.filter(
    (check) => check.status === "BLOCK",
  ).length;

  const overallStatus: SafetyLevel =
    blockCount > 0
      ? "BLOCK"
      : cautionCount > 0
        ? "CAUTION"
        : "PASS";

  const overallText =
    overallStatus === "PASS"
      ? "Pre-trade checks passed"
      : overallStatus === "CAUTION"
        ? "Review before trading"
        : "Trade blocked by safety checks";

  const overallDescription =
    overallStatus === "PASS"
      ? "No blocking conditions were detected by the scored StockShield checks."
      : overallStatus === "CAUTION"
        ? "No blocking condition was detected, but one or more scored conditions deserve attention."
        : "One or more scored safety conditions must be resolved before execution.";

  const overallClass =
    overallStatus === "PASS"
      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
      : overallStatus === "CAUTION"
        ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300"
        : "border-red-400/20 bg-red-400/[0.06] text-red-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            StockShield Safety Engine
          </div>

          <div className="mt-2 text-lg font-bold">
            {overallText}
          </div>

          <div className="mt-1 max-w-md text-xs leading-5 text-zinc-500">
            {overallDescription}
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs font-bold ${overallClass}`}
        >
          {overallStatus}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <SummaryBox
          label="PASS"
          value={passCount}
          className="text-emerald-300"
        />

        <SummaryBox
          label="CAUTION"
          value={cautionCount}
          className="text-amber-300"
        />

        <SummaryBox
          label="BLOCK"
          value={blockCount}
          className="text-red-300"
        />
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

              <div className="mt-1 text-xs leading-5 text-zinc-500">
                {check.message}
              </div>
            </div>

            <StatusBadge status={check.status} />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-500">
        <span className="font-medium text-zinc-300">
          Transparent MVP rules:
        </span>{" "}
        StockShield scores only data that is available for the
        relevant check. Demo fallback market, reference and liquidity
        values are excluded from scoring. Slippage is explicitly
        identified as an MVP estimate. Market impact comes from the
        live on-chain quote. These heuristic checks provide execution
        context and do not guarantee trade outcomes.
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3 text-center">
      <div className={`text-lg font-bold ${className}`}>
        {value}
      </div>

      <div className="mt-1 text-[10px] font-medium tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: DisplayStatus;
}) {
  const className =
    status === "PASS"
      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : status === "CAUTION"
        ? "border border-amber-400/20 bg-amber-400/10 text-amber-300"
        : status === "BLOCK"
          ? "border border-red-400/20 bg-red-400/10 text-red-300"
          : "border border-sky-400/20 bg-sky-400/10 text-sky-300";

  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${className}`}
    >
      {status}
    </span>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}