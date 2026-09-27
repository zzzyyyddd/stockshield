import { NextRequest, NextResponse } from "next/server";
import { parseUnits, formatUnits } from "viem";

const CHAIN_ID = 56;

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const NVDAB = "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436";

interface PancakeQuote {
  trade?: {
    inputAmount?: string;
    outputAmount?: string;
    priceImpact?: string;
    blockNumber?: number;
    routes?: Array<{
      type?: string;
      pools?: unknown[];
    }>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const amountText =
      request.nextUrl.searchParams.get("amount") ?? "20";

    const amountNumber = Number(amountText);

    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      amountNumber > 100000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Amount must be greater than 0 and no more than 100000 USDT.",
        },
        { status: 400 },
      );
    }

    // BSC USDT uses 18 decimals.
    const amountRaw = parseUnits(amountText, 18);

    const url = new URL(
      "https://router.pancakeswap.finance/v0/quote",
    );

    url.searchParams.set("tokenInAddress", USDT);
    url.searchParams.set("tokenInChainId", String(CHAIN_ID));
    url.searchParams.set("tokenOutAddress", NVDAB);
    url.searchParams.set("tokenOutChainId", String(CHAIN_ID));
    url.searchParams.set("amount", amountRaw.toString());
    url.searchParams.set("type", "exactIn");
    url.searchParams.set("maxHops", "3");
    url.searchParams.set("maxSplits", "4");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const data = (await response.json()) as PancakeQuote;

    if (!response.ok || !data.trade?.outputAmount) {
      return NextResponse.json(
        {
          success: false,
          mode: "routing-api",
          provider: "PancakeSwap Routing API",
          error: "No executable PancakeSwap quote returned.",
          upstreamStatus: response.status,
        },
        { status: 502 },
      );
    }

    const amountOutRaw = data.trade.outputAmount;

    // NVDAB uses 18 decimals.
    const amountOut = formatUnits(
      BigInt(amountOutRaw),
      18,
    );

    const effectivePrice =
      Number(amountOut) > 0
        ? amountNumber / Number(amountOut)
        : null;

    return NextResponse.json({
      success: true,
      mode: "live",
      provider: "PancakeSwap Routing API",

      chain: "BNB Smart Chain",
      chainId: CHAIN_ID,

      pair: {
        input: "USDT",
        output: "NVDAB",
      },

      contracts: {
        USDT,
        NVDAB,
      },

      quote: {
        amountIn: amountText,
        amountOut,
        effectivePrice,
        priceImpact: data.trade.priceImpact ?? null,
      },

      routing: {
        blockNumber: data.trade.blockNumber ?? null,
        routes:
          data.trade.routes?.map((route) => ({
            type: route.type ?? "UNKNOWN",
            pools: route.pools?.length ?? 0,
          })) ?? [],
      },

      timestamp: new Date().toISOString(),

      safety: {
        readOnly: true,
        approvalRequested: false,
        transactionSubmitted: false,
      },
    });
  } catch (error) {
    console.error("StockShield quote error:", error);

    return NextResponse.json(
      {
        success: false,
        mode: "routing-api",
        provider: "PancakeSwap Routing API",
        error:
          error instanceof Error
            ? error.message
            : "Unknown quote error",
      },
      { status: 500 },
    );
  }
}