import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.BINANCE_WEB3_API_KEY;
    const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "API credentials are missing.",
        },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString();
    const method = "GET";

    // Path endpoint Binance
    const apiPath = "/api/v1/dex/market/rwa/search";
    const query = "keyword=NVDA";

    // IMPORTANT:
    // Binance requires /build inside the SIGNED request path.
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

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("StockShield RWA error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Binance RWA data.",
      },
      { status: 500 }
    );
  }
}