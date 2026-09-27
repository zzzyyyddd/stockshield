import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";

const POOL = "0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C" as const;

const poolAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint24" }],
  },
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint128" }],
  },
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint32" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export async function GET() {
  try {
    const client = createPublicClient({
      chain: bsc,
      transport: http("https://1rpc.io/bnb"),
    });

    const [blockNumber, token0, token1, fee, liquidity, slot0] =
      await Promise.all([
        client.getBlockNumber(),
        client.readContract({
          address: POOL,
          abi: poolAbi,
          functionName: "token0",
        }),
        client.readContract({
          address: POOL,
          abi: poolAbi,
          functionName: "token1",
        }),
        client.readContract({
          address: POOL,
          abi: poolAbi,
          functionName: "fee",
        }),
        client.readContract({
          address: POOL,
          abi: poolAbi,
          functionName: "liquidity",
        }),
        client.readContract({
          address: POOL,
          abi: poolAbi,
          functionName: "slot0",
        }),
      ]);

    const [symbol0, decimals0, symbol1, decimals1] =
      await Promise.all([
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);

    return NextResponse.json({
      success: true,
      mode: "onchain-pool-validation",
      provider: "PancakeSwap V3",
      chain: "BNB Smart Chain",
      chainId: 56,
      blockNumber: blockNumber.toString(),

      pool: {
        address: POOL,
        token0: {
          address: token0,
          symbol: symbol0,
          decimals: decimals0,
        },
        token1: {
          address: token1,
          symbol: symbol1,
          decimals: decimals1,
        },
        fee,
        feePercent: Number(fee) / 10000,
        liquidityRaw: liquidity.toString(),
        sqrtPriceX96: slot0[0].toString(),
        tick: slot0[1],
        unlocked: slot0[6],
      },

      safety: {
        readOnly: true,
        approvalRequested: false,
        transactionSubmitted: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: "onchain-pool-validation",
        error:
          error instanceof Error ? error.message : "Unknown on-chain error",
      },
      { status: 500 },
    );
  }
}