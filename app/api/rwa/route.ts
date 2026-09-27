import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const demoStocks = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    price: 184.8,
    referencePrice: 183.9,
    deviation: 0.49,
    liquidity: 1240000,
    marketStatus: "CLOSED",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    price: 421.2,
    referencePrice: 420.8,
    deviation: 0.1,
    liquidity: 980000,
    marketStatus: "CLOSED",
  },
  {
    symbol: "AAPL",
    name: "Apple",
    price: 291.42,
    referencePrice: 290.95,
    deviation: 0.16,
    liquidity: 1510000,
    marketStatus: "CLOSED",
  },
];

export async function GET() {
  try {
    const apiKey = process.env.BINANCE_WEB3_API_KEY;
    const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json({
        success: true,
        mode: "demo",
        reason: "Binance API credentials are not configured.",
        data: demoStocks,
      });
    }

    const timestamp = new Date().toISOString();
    const method = "GET";

    const apiPath = "/api/v1/dex/market/rwa/search";
    const query = "keyword=NVDA";

    const signedRequestPath = `/build${apiPath}?${query}`;
    const body = "";

    const preHash =
      timestamp +
      method +
      signedRequestPath +
      body;

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(preHash, "utf8")
      .digest("base64");

    const url =
      `https://web3.binance.com/build${apiPath}?${query}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-OC-APIKEY": apiKey,
        "X-OC-TIMESTAMP": timestamp,
        "X-OC-SIGN": signature,
        "X-OC-RECV-WINDOW": "60000",
      },
      cache: "no-store",
    });

    const binanceData = await response.json();

    // Binance compliance restriction:
    // fall back transparently instead of breaking StockShield.
    if (binanceData?.code === 40304) {
      return NextResponse.json({
        success: true,
        mode: "demo",
        provider: "Binance Web3 API",
        reason:
          "Binance Web3 RWA API is unavailable in this environment due to a compliance restriction.",
        upstreamCode: 40304,
        data: demoStocks,
      });
    }

    if (!response.ok || binanceData?.code) {
      return NextResponse.json(
        {
          success: false,
          mode: "error",
          provider: "Binance Web3 API",
          upstreamStatus: response.status,
          upstreamCode: binanceData?.code ?? null,
          message:
            binanceData?.msg ??
            "Binance Web3 API returned an unexpected error.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      provider: "Binance Web3 API",
      data: binanceData,
    });
  } catch (error) {
    console.error("StockShield RWA error:", error);

    return NextResponse.json({
      success: true,
      mode: "demo",
      reason:
        "Live RWA data is temporarily unavailable. StockShield is using demo data.",
      data: demoStocks,
    });
  }
}