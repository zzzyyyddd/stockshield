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
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
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

const poolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "sqrtPriceX96",
        type: "uint160",
      },
      {
        name: "tick",
        type: "int24",
      },
      {
        name: "observationIndex",
        type: "uint16",
      },
      {
        name: "observationCardinality",
        type: "uint16",
      },
      {
        name: "observationCardinalityNext",
        type: "uint16",
      },
      {
        name: "feeProtocol",
        type: "uint32",
      },
      {
        name: "unlocked",
        type: "bool",
      },
    ],
  },
] as const;

function calculateSpotPrice(
  sqrtPriceX96: bigint,
) {
  /*
   * Pool:
   * token0 = NVDAB
   * token1 = USDT
   *
   * Both tokens use 18 decimals.
   *
   * price token0 in token1:
   *
   * (sqrtPriceX96 / 2^96)^2
   *
   * Therefore the result is:
   * USDT per NVDAB.
   */

  const Q96 = BigInt(2) ** BigInt(96);

  /*
   * Avoid converting the huge Q96 integer directly
   * before reducing the magnitude.
   *
   * Number() is acceptable here for UI analytics,
   * while contract amounts remain bigint.
   */
  const sqrtRatio =
    Number(sqrtPriceX96) / Number(Q96);

  return sqrtRatio * sqrtRatio;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const amountText =
      request.nextUrl.searchParams.get(
        "amount",
      ) ?? "20";

    const amountNumber =
      Number(amountText);

    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      amountNumber > 100000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid USDT amount.",
        },
        {
          status: 400,
        },
      );
    }

    const amountIn =
      parseUnits(amountText, 18);

    const client =
      createPublicClient({
        chain: bsc,
        transport: http(RPC),
      });

    /*
     * Read the pool price BEFORE
     * the simulated swap.
     */
    const slot0 =
      await client.readContract({
        address: POOL,
        abi: poolAbi,
        functionName: "slot0",
      });

    const sqrtPriceX96Before =
      slot0[0];

    const tickBefore =
      slot0[1];

    const spotPrice =
      calculateSpotPrice(
        sqrtPriceX96Before,
      );

    /*
     * Read-only Quoter simulation.
     * No approval, signature or
     * transaction is submitted.
     */
    const simulation =
      await client.simulateContract({
        address: QUOTER,
        abi: quoterAbi,
        functionName:
          "quoteExactInputSingle",
        args: [
          {
            tokenIn: USDT,
            tokenOut: NVDAB,
            amountIn,
            fee: FEE,
            sqrtPriceLimitX96:
              BigInt(0),
          },
        ],
      });

    const [
      amountOutRaw,
      sqrtPriceX96After,
      initializedTicksCrossed,
      gasEstimate,
    ] = simulation.result;

    const amountOut =
      formatUnits(
        amountOutRaw,
        18,
      );

    const amountOutNumber =
      Number(amountOut);

    const effectivePrice =
      amountOutNumber > 0
        ? amountNumber /
          amountOutNumber
        : null;

    /*
     * Price impact compares the
     * effective execution price
     * with the pre-trade pool
     * spot price.
     */
    const priceImpactPercent =
      effectivePrice !== null &&
      spotPrice > 0
        ? Math.max(
            0,
            ((effectivePrice -
              spotPrice) /
              spotPrice) *
              100,
          )
        : null;

    const spotPriceAfter =
      calculateSpotPrice(
        sqrtPriceX96After,
      );

    const blockNumber =
      await client.getBlockNumber();

    return NextResponse.json({
      success: true,

      mode:
        "onchain-live-quote",

      provider:
        "PancakeSwap V3 QuoterV2",

      chain:
        "BNB Smart Chain",

      chainId: 56,

      blockNumber:
        blockNumber.toString(),

      pair: {
        input: "USDT",
        output: "NVDAB",
      },

      pool: {
        address: POOL,
        fee: FEE,
        feePercent: 0.25,
        token0: "NVDAB",
        token1: "USDT",
      },

      quote: {
        amountIn:
          amountText,

        amountOut,

        amountOutRaw:
          amountOutRaw.toString(),

        spotPrice,

        effectivePrice,

        priceImpactPercent,

        spotPriceAfter,

        tickBefore:
          Number(tickBefore),

        sqrtPriceX96Before:
          sqrtPriceX96Before.toString(),

        sqrtPriceX96After:
          sqrtPriceX96After.toString(),

        initializedTicksCrossed:
          Number(
            initializedTicksCrossed,
          ),

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

        mode:
          "onchain-live-quote",

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