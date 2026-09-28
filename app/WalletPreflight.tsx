"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  formatUnits,
  http,
} from "viem";
import { bsc } from "viem/chains";

const RPC = "https://1rpc.io/bnb";

const USDT =
  "0x55d398326f99059fF775485246999027B3197955" as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      {
        name: "account",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
] as const;

type Props = {
  address: `0x${string}` | null;
};

export default function WalletPreflight({
  address,
}: Props) {
  const [usdtBalance, setUsdtBalance] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setUsdtBalance(null);
      setError(null);
      return;
    }

    let active = true;

    async function loadBalance() {
      try {
        setLoading(true);
        setError(null);

        const client =
          createPublicClient({
            chain: bsc,
            transport: http(RPC),
          });

        const balance =
          await client.readContract({
            address: USDT,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address!],
          });

        if (!active) return;

        setUsdtBalance(
          formatUnits(balance, 18),
        );
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to read USDT balance.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBalance();

    return () => {
      active = false;
    };
  }, [address]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        Wallet preflight
      </div>

      {!address && (
        <div className="mt-3 text-sm text-zinc-400">
          Connect wallet to check trade readiness.
        </div>
      )}

      {address && loading && (
        <div className="mt-3 text-sm text-zinc-400">
          Reading USDT balance...
        </div>
      )}

      {address &&
        !loading &&
        usdtBalance !== null && (
          <div className="mt-3">
            <div className="text-xs text-zinc-500">
              USDT balance
            </div>

            <div className="mt-1 font-semibold text-white">
              {Number(usdtBalance).toFixed(6)} USDT
            </div>

            <div className="mt-2 text-xs text-emerald-300">
              READ ONLY · No approval or transaction requested
            </div>
          </div>
        )}

      {error && (
        <div className="mt-3 text-xs text-red-300">
          Unable to read USDT balance.
        </div>
      )}
    </div>
  );
}