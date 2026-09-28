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

// PancakeSwap Permit2 — BSC Mainnet
const PANCAKESWAP_PERMIT2 =
  "0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768" as const;

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
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "spender",
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
  tradeAmount: number;
};

export default function WalletPreflight({
  address,
  tradeAmount,
}: Props) {
  const [usdtBalance, setUsdtBalance] =
    useState<string | null>(null);

  const [permit2Allowance, setPermit2Allowance] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setUsdtBalance(null);
      setPermit2Allowance(null);
      setError(null);
      return;
    }

    let active = true;

    async function loadPreflight() {
      try {
        setLoading(true);
        setError(null);

        const client = createPublicClient({
          chain: bsc,
          transport: http(RPC),
        });

        const [balance, allowance] =
          await Promise.all([
            client.readContract({
              address: USDT,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address!],
            }),

            client.readContract({
              address: USDT,
              abi: erc20Abi,
              functionName: "allowance",
              args: [
                address!,
                PANCAKESWAP_PERMIT2,
              ],
            }),
          ]);

        if (!active) return;

        setUsdtBalance(
          formatUnits(balance, 18),
        );

        setPermit2Allowance(
          formatUnits(allowance, 18),
        );
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to read wallet preflight.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreflight();

    return () => {
      active = false;
    };
  }, [address]);

  const balanceNumber =
    usdtBalance !== null
      ? Number(usdtBalance)
      : null;

  const allowanceNumber =
    permit2Allowance !== null
      ? Number(permit2Allowance)
      : null;

  const validTradeAmount =
    Number.isFinite(tradeAmount) &&
    tradeAmount > 0;

  const hasEnoughBalance =
    validTradeAmount &&
    balanceNumber !== null &&
    balanceNumber >= tradeAmount;

  const hasEnoughAllowance =
    validTradeAmount &&
    allowanceNumber !== null &&
    allowanceNumber >= tradeAmount;

  const erc20PreflightReady =
    hasEnoughBalance &&
    hasEnoughAllowance;

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
          Reading wallet state...
        </div>
      )}

      {address &&
        !loading &&
        usdtBalance !== null &&
        permit2Allowance !== null && (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-xs text-zinc-500">
                USDT balance
              </div>

              <div className="mt-1 font-semibold text-white">
                {Number(usdtBalance).toFixed(6)} USDT
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">
                USDT allowance to PancakeSwap Permit2
              </div>

              <div className="mt-1 font-semibold text-white">
                {allowanceNumber !== null &&
                allowanceNumber > 1_000_000
                  ? "Large existing allowance"
                  : `${Number(permit2Allowance).toFixed(6)} USDT`}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs text-zinc-500">
                Trade readiness for{" "}
                {validTradeAmount
                  ? tradeAmount.toFixed(2)
                  : "0.00"}{" "}
                USDT
              </div>

              {!validTradeAmount ? (
                <div className="mt-2 text-xs text-amber-300">
                  Enter a valid trade amount.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div
                    className={
                      hasEnoughBalance
                        ? "text-xs text-emerald-300"
                        : "text-xs text-amber-300"
                    }
                  >
                    USDT balance:{" "}
                    {hasEnoughBalance
                      ? "SUFFICIENT"
                      : "INSUFFICIENT"}
                  </div>

                  <div
                    className={
                      hasEnoughAllowance
                        ? "text-xs text-emerald-300"
                        : "text-xs text-amber-300"
                    }
                  >
                    Permit2 allowance:{" "}
                    {hasEnoughAllowance
                      ? "SUFFICIENT"
                      : "INSUFFICIENT"}
                  </div>

                  <div
                    className={
                      erc20PreflightReady
                        ? "text-sm font-semibold text-emerald-300"
                        : "text-sm font-semibold text-amber-300"
                    }
                  >
                    {erc20PreflightReady
                      ? "ERC-20 PREFLIGHT READY"
                      : "ERC-20 PREFLIGHT NOT READY"}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-zinc-500">
                Permit2 router authorization is checked separately.
              </div>
            </div>

            <div className="text-xs text-emerald-300">
              READ ONLY · No approval, signature, or transaction requested
            </div>
          </div>
        )}

      {error && (
        <div className="mt-3 text-xs text-red-300">
          Unable to read wallet preflight.
        </div>
      )}
    </div>
  );
}