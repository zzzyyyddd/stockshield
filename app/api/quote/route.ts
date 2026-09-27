import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
} from "viem";
import { bsc } from "viem/chains";

const RPC = "https://1rpc.io/bnb";

const QUOTER =
  "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as const;

const USDT =
  "0x55d398326f99059fF775485246999027B3197955" as const;

const NVDAB =
  "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436" as const;

const POOL =
  "0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C" as const;

const FEE = 2500;

const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "tokenIn",
            type: "address",
          },
          {
            name: "tokenOut",
            type: "address",
          },
          {
            name: "amountIn",
            type: "uint256",
          },
          {
            name: "fee",
            type: "uint24",
          },
          {
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "amountOut",
        type: "uint256",
      },
      {
        name: "sqrtPriceX96After",
        type: "uint160",
      },
      {
        name: "initializedTicksCrossed",
        type: "uint32",
      },
      {
        name: "gasEstimate",
        type: "uint256",
      },
    ],
  },
] as const;

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
          error: "Invalid USDT amount.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * USDT BSC dan NVDAB sudah kita validasi langsung
     * dari kontrak dan keduanya menggunakan 18 decimals.
     */
    const amountIn = parseUnits(amountText, 18);

    const client = createPublicClient({
      chain: bsc,
      transport: http(RPC),
    });

    /*
     * simulateContract hanya melakukan simulasi RPC.
     *
     * Tidak mengirim transaksi.
     * Tidak meminta approval.
     * Tidak meminta signature wallet.
     */
    const simulation = await client.simulateContract({
      address: QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: USDT,
          tokenOut: NVDAB,
          amountIn: amountIn,
          fee: FEE,

          // Ditulis seperti ini agar kompatibel
          // dengan target TypeScript project kita.
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });

    const [
      amountOutRaw,
      sqrtPriceX96After,
      initializedTicksCrossed,
      gasEstimate,
    ] = simulation.result;

    const amountOut = formatUnits(
      amountOutRaw,
      18,
    );

    const effectivePrice =
      Number(amountOut) > 0
        ? amountNumber / Number(amountOut)
        : null;

    const blockNumber =
      await client.getBlockNumber();

    return NextResponse.json({
      success: true,

      mode: "onchain-live-quote",

      provider:
        "PancakeSwap V3 QuoterV2",

      chain: "BNB Smart Chain",

      chainId: 56,

      blockNumber:
        blockNumber.toString(),

      pair: {
        input: "USDT",
        output: "NVDAB",
      },

      contracts: {
        quoter: QUOTER,
        usdt: USDT,
        nvdab: NVDAB,
      },

      pool: {
        address: POOL,
        fee: FEE,
        feePercent: 0.25,
      },

      quote: {
        amountIn: amountText,

        amountOut: amountOut,

        amountOutRaw:
          amountOutRaw.toString(),

        effectivePrice:
          effectivePrice,

        sqrtPriceX96After:
          sqrtPriceX96After.toString(),

        initializedTicksCrossed:
          Number(initializedTicksCrossed),

        gasEstimate:
          gasEstimate.toString(),
      },

      safety: {
        readOnly: true,

        approvalRequested: false,

        signatureRequested: false,

        transactionSubmitted: false,
      },

      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        mode: "onchain-live-quote",

        provider:
          "PancakeSwap V3 QuoterV2",

        error:
          error instanceof Error
            ? error.message
            : "Unknown quote error",
      },
      {
        status: 500,
      },
    );
  }
}