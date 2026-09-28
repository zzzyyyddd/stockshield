import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { bsc } from "viem/chains";
import {
  CurrencyAmount,
  Token,
  TradeType,
} from "@pancakeswap/sdk";
import { Percent } from "@pancakeswap/swap-sdk-core";
import { PoolType, SmartRouter, type V3Pool } from "@pancakeswap/smart-router";
import { PancakeSwapUniversalRouter } from "@pancakeswap/universal-router-sdk";

const RPC_URL = "https://1rpc.io/bnb";

const USDT_ADDRESS =
  "0x55d398326f99059fF775485246999027B3197955" as const;

const NVDAB_ADDRESS =
  "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436" as const;

const POOL_ADDRESS =
  "0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C" as const;

const QUOTER_V2 =
  "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as const;

const FEE = 2500;

const poolAbi = [
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
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "", type: "uint128" },
    ],
  },
] as const;

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
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const client = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
});

export async function GET(request: NextRequest) {
  try {
    const amountText =
      request.nextUrl.searchParams.get("amount") ?? "20";

    const recipient =
      request.nextUrl.searchParams.get("recipient");

    const amountNumber = Number(amountText);

    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      amountNumber > 100000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid trade amount.",
        },
        { status: 400 },
      );
    }

    if (
      !recipient ||
      !/^0x[a-fA-F0-9]{40}$/.test(recipient)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid recipient wallet address is required.",
        },
        { status: 400 },
      );
    }

    const amountInRaw = parseUnits(amountText, 18);

    const [
      slot0,
      liquidity,
      blockNumber,
      quoteSimulation,
    ] = await Promise.all([
      client.readContract({
        address: POOL_ADDRESS,
        abi: poolAbi,
        functionName: "slot0",
      }),

      client.readContract({
        address: POOL_ADDRESS,
        abi: poolAbi,
        functionName: "liquidity",
      }),

      client.getBlockNumber(),

      client.simulateContract({
        address: QUOTER_V2,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: USDT_ADDRESS,
            tokenOut: NVDAB_ADDRESS,
            amountIn: amountInRaw,
            fee: FEE,
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      }),
    ]);

    const sqrtPriceX96 = slot0[0];
    const tickCurrent = slot0[1];

    const amountOutRaw =
      quoteSimulation.result[0];

    if (amountOutRaw <= BigInt(0)) {
      throw new Error(
        "Quoter returned zero output.",
      );
    }

    const usdt = new Token(
      bsc.id,
      USDT_ADDRESS,
      18,
      "USDT",
      "Tether USD",
    );

    const nvdab = new Token(
      bsc.id,
      NVDAB_ADDRESS,
      18,
      "NVDAB",
      "NVIDIA Tokenized Stock",
    );

    const token0 =
      usdt.sortsBefore(nvdab) ? usdt : nvdab;

    const token1 =
      usdt.sortsBefore(nvdab) ? nvdab : usdt;

    const pool: V3Pool = {
      type: PoolType.V3,
      token0,
      token1,
      fee: FEE,
      liquidity,
      sqrtRatioX96: sqrtPriceX96,
      tick: tickCurrent,
      address: POOL_ADDRESS,
      token0ProtocolFee: new Percent(0, 100),
      token1ProtocolFee: new Percent(0, 100),
    };

    const inputAmount =
      CurrencyAmount.fromRawAmount(
        usdt,
        amountInRaw.toString(),
      );

    const outputAmount =
      CurrencyAmount.fromRawAmount(
        nvdab,
        amountOutRaw.toString(),
      );

    const baseRoute =
      SmartRouter.buildBaseRoute(
        [pool],
        usdt,
        nvdab,
      );

    const route = {
      ...baseRoute,
      percent: 100,
      inputAmount,
      outputAmount,
    };

    const trade = {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount,
      outputAmount,
      routes: [route],
      blockNumber: Number(blockNumber),
    };

    const slippageTolerance =
      new Percent(50, 10000);

    const minimumOut =
      SmartRouter.minimumAmountOut(
        trade,
        slippageTolerance,
      );

    const minimumOutRaw =
      minimumOut.quotient;

    /*
     * Deadline is created immediately before calldata generation.
     * It therefore means 20 minutes from transaction preparation,
     * not 20 minutes after wallet confirmation.
     */
    const deadline =
      Math.floor(Date.now() / 1000) +
      20 * 60;

    const parameters =
      PancakeSwapUniversalRouter.swapERC20CallParameters(
        trade,
        {
          recipient:
            recipient as `0x${string}`,
          slippageTolerance,
          deadlineOrPreviousBlockhash:
            deadline,
          payerIsUser: true,
        },
      );

    const decoded =
      PancakeSwapUniversalRouter.decodeCallData(
        parameters.calldata as `0x${string}`,
      );

    const decodedSafe = JSON.parse(
      JSON.stringify(
        decoded,
        (_, value) =>
          typeof value === "bigint"
            ? value.toString()
            : value,
      ),
    );

    let simulationStatus:
      | "SIMULATABLE"
      | "BLOCKED_BY_WALLET_STATE"
      | "PERMIT2_AUTHORIZATION_EXPIRED"
      | "FAILED" = "FAILED";

    let simulationError: string | null = null;

    try {
      await client.call({
        account: recipient as `0x${string}`,
        to: "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB",
        data: parameters.calldata as `0x${string}`,
        value: BigInt(0),
      });

      simulationStatus = "SIMULATABLE";
    } catch (simulationFailure) {
      simulationError =
        simulationFailure instanceof Error
          ? simulationFailure.message
          : "Universal Router simulation reverted.";

      if (
        simulationError
          .toLowerCase()
          .includes("0xd81b2f2e")
      ) {
        simulationStatus =
          "PERMIT2_AUTHORIZATION_EXPIRED";
      } else {
        simulationStatus =
          "BLOCKED_BY_WALLET_STATE";
      }
    }

    return NextResponse.json({
      success: true,

      mode: "READ_ONLY_SWAP_PREVIEW",

      provider:
        "PancakeSwap V3 + Universal Router",

      chain: {
        name: "BNB Smart Chain",
        chainId: bsc.id,
        blockNumber:
          blockNumber.toString(),
      },

      route: {
        inputToken: "USDT",
        outputToken: "NVDAB",
        pool: POOL_ADDRESS,
        fee: FEE,
        feePercent: 0.25,
        percent: 100,
      },

      quote: {
        amountIn: formatUnits(
          amountInRaw,
          18,
        ),
        amountInRaw:
          amountInRaw.toString(),

        expectedOut: formatUnits(
          amountOutRaw,
          18,
        ),
        expectedOutRaw:
          amountOutRaw.toString(),

        minimumReceived: formatUnits(
          minimumOutRaw,
          18,
        ),
        minimumReceivedRaw:
          minimumOutRaw.toString(),

        maxSlippagePercent: 0.5,
      },

      executionProtection: {
        deadline,
        deadlineMeaning:
          "20 minutes from calldata preparation",
        exactInput: true,
        payerIsUser: true,
      },

      universalRouter: {
        calldata:
          parameters.calldata,
        value:
          parameters.value.toString(),
        decodedCommands: decodedSafe,
      },

      quoter: {
        address: QUOTER_V2,
        sqrtPriceX96After:
          quoteSimulation.result[1].toString(),
        initializedTicksCrossed:
          quoteSimulation.result[2],
        gasEstimate:
          quoteSimulation.result[3].toString(),
      },

      simulation: {
        status: simulationStatus,
        router:
          "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB",
        error: simulationError,
      },

      safety: {
        readOnly: true,
        walletRequested: false,
        approvalRequested: false,
        signatureRequested: false,
        transactionSubmitted: false,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown swap preview error.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        safety: {
          readOnly: true,
          walletRequested: false,
          approvalRequested: false,
          signatureRequested: false,
          transactionSubmitted: false,
        },
      },
      { status: 500 },
    );
  }
}






