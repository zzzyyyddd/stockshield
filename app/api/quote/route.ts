import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";

export async function GET() {
  try {
    const client = createPublicClient({
      chain: bsc,
      transport: http("https://1rpc.io/bnb"),
    });

    const blockNumber = await client.getBlockNumber();

    return NextResponse.json({
      success: true,
      test: "BSC RPC",
      chain: "BNB Smart Chain",
      chainId: 56,
      blockNumber: blockNumber.toString(),
      rpcReachable: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        test: "BSC RPC",
        rpcReachable: false,
        error:
          error instanceof Error ? error.message : "Unknown RPC error",
      },
      { status: 500 },
    );
  }
}