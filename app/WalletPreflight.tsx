"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { bsc } from "viem/chains";

const RPC = "https://1rpc.io/bnb";

const USDT =
  "0x55d398326f99059fF775485246999027B3197955" as const;

const PANCAKESWAP_PERMIT2 =
  "0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768" as const;

const PANCAKESWAP_V3_ROUTER =
  "0x1A0A18AC4BECDDbd6389559687d1A73d8927E416" as const;

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

const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
      {
        name: "token",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "amount",
        type: "uint160",
      },
      {
        name: "expiration",
        type: "uint48",
      },
      {
        name: "nonce",
        type: "uint48",
      },
    ],
  },
] as const;

type Props = {
  address: `0x${string}` | null;
  tradeAmount: number;
};

type Permit2State = {
  amount: bigint;
  expiration: number;
  nonce: number;
};

export default function WalletPreflight({
  address,
  tradeAmount,
}: Props) {
  const [usdtBalance, setUsdtBalance] =
    useState<bigint | null>(null);

  const [erc20Allowance, setErc20Allowance] =
    useState<bigint | null>(null);

  const [permit2State, setPermit2State] =
    useState<Permit2State | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [authorizing, setAuthorizing] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setUsdtBalance(null);
      setErc20Allowance(null);
      setPermit2State(null);
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

        const [
          balance,
          allowanceToPermit2,
          routerAllowance,
        ] = await Promise.all([
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

          client.readContract({
            address: PANCAKESWAP_PERMIT2,
            abi: permit2Abi,
            functionName: "allowance",
            args: [
              address!,
              USDT,
              PANCAKESWAP_V3_ROUTER,
            ],
          }),
        ]);

        if (!active) return;

        setUsdtBalance(balance);
        setErc20Allowance(allowanceToPermit2);

        setPermit2State({
          amount: routerAllowance[0],
          expiration: Number(routerAllowance[1]),
          nonce: Number(routerAllowance[2]),
        });
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

  function handleAuthorizeRouterPreview() {
    setAuthorizing(true);
    setAuthorizationStatus(
      "READY TO REQUEST — Wallet confirmation will be required. No transaction has been sent."
    );

    setTimeout(() => {
      setAuthorizing(false);
    }, 500);
  }

  async function handleRequestRouterAuthorization() {
    if (!address) {
      setAuthorizationStatus("Wallet is not connected.");
      return;
    }

    if (!window.ethereum) {
      setAuthorizationStatus("MetaMask or another EVM wallet was not detected.");
      return;
    }

    if (!Number.isFinite(tradeAmount) || tradeAmount <= 0) {
      setAuthorizationStatus("Enter a valid trade amount first.");
      return;
    }

    const requestedAmount = parseUnits(tradeAmount.toString(), 18);

    if (usdtBalance === null || usdtBalance < requestedAmount) {
      setAuthorizationStatus(
        "BLOCKED — Insufficient USDT balance. No wallet request was sent."
      );
      return;
    }

    try {
      setAuthorizing(true);
      setAuthorizationStatus(
        "WAITING FOR WALLET — Review the Permit2 authorization carefully."
      );

      const walletClient = createWalletClient({
        account: address,
        chain: bsc,
        transport: custom(window.ethereum),
      });

      const chainId = await walletClient.getChainId();

      if (chainId !== bsc.id) {
        setAuthorizationStatus(
          "WRONG NETWORK — Switch MetaMask to BNB Smart Chain first."
        );
        return;
      }

      const authorizationAmount = parseUnits(
        tradeAmount.toString(),
        18,
      );

      const expiration = Math.floor(Date.now() / 1000) + 60 * 60;

      const hash = await walletClient.writeContract({
        address: PANCAKESWAP_PERMIT2,
        abi: permit2Abi,
        functionName: "approve",
        args: [
          USDT,
          PANCAKESWAP_V3_ROUTER,
          authorizationAmount,
          expiration,
        ],
      });

      setAuthorizationStatus(
        `AUTHORIZATION SUBMITTED — ${hash}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Authorization request failed.";

      setAuthorizationStatus(
        `AUTHORIZATION NOT SENT / FAILED — ${message}`
      );
    } finally {
      setAuthorizing(false);
    }
  }
  const validTradeAmount =
    Number.isFinite(tradeAmount) &&
    tradeAmount > 0;

  let requiredAmount = BigInt(0);

  if (validTradeAmount) {
    try {
      requiredAmount = parseUnits(
        tradeAmount.toString(),
        18,
      );
    } catch {
      requiredAmount = BigInt(0);
    }
  }

  const hasEnoughBalance =
    validTradeAmount &&
    usdtBalance !== null &&
    usdtBalance >= requiredAmount;

  const hasEnoughErc20Allowance =
    validTradeAmount &&
    erc20Allowance !== null &&
    erc20Allowance >= requiredAmount;

  const nowSeconds =
    Math.floor(Date.now() / 1000);

  const permit2NotExpired =
    permit2State !== null &&
    permit2State.expiration > nowSeconds;

  const hasEnoughRouterAllowance =
    validTradeAmount &&
    permit2State !== null &&
    permit2State.amount >= requiredAmount &&
    permit2NotExpired;

  const fullPreflightReady =
    hasEnoughBalance &&
    hasEnoughErc20Allowance &&
    hasEnoughRouterAllowance;

  const permit2Expiration =
    permit2State &&
    permit2State.expiration > 0
      ? new Date(
          permit2State.expiration * 1000,
        ).toLocaleString()
      : "Not authorized";

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
          Reading wallet and Permit2 state...
        </div>
      )}

      {address &&
        !loading &&
        usdtBalance !== null &&
        erc20Allowance !== null &&
        permit2State !== null && (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-xs text-zinc-500">
                USDT balance
              </div>

              <div className="mt-1 font-semibold text-white">
                {Number(
                  formatUnits(usdtBalance, 18),
                ).toFixed(6)}{" "}
                USDT
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">
                USDT allowance to PancakeSwap Permit2
              </div>

              <div className="mt-1 font-semibold text-white">
                {erc20Allowance >
                parseUnits("1000000", 18)
                  ? "Large existing allowance"
                  : `${Number(
                      formatUnits(
                        erc20Allowance,
                        18,
                      ),
                    ).toFixed(6)} USDT`}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-medium text-zinc-400">
                Permit2 → PancakeSwap V3 Router
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                Router allowance
              </div>

              <div className="mt-1 text-sm font-semibold text-white">
                {permit2State.amount >
                parseUnits("1000000", 18)
                  ? "Large existing allowance"
                  : `${Number(
                      formatUnits(
                        permit2State.amount,
                        18,
                      ),
                    ).toFixed(6)} USDT`}
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                Authorization expiration
              </div>

              <div
                className={
                  permit2NotExpired
                    ? "mt-1 text-xs text-emerald-300"
                    : "mt-1 text-xs text-amber-300"
                }
              >
                {permit2Expiration}
                {" · "}
                {permit2NotExpired
                  ? "ACTIVE"
                  : "EXPIRED / NOT AUTHORIZED"}
              </div>

              <div className="mt-2 text-xs text-zinc-600">
                Permit2 nonce: {permit2State.nonce}
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
                      hasEnoughErc20Allowance
                        ? "text-xs text-emerald-300"
                        : "text-xs text-amber-300"
                    }
                  >
                    ERC-20 → Permit2:{" "}
                    {hasEnoughErc20Allowance
                      ? "SUFFICIENT"
                      : "INSUFFICIENT"}
                  </div>

                  <div
                    className={
                      hasEnoughRouterAllowance
                        ? "text-xs text-emerald-300"
                        : "text-xs text-amber-300"
                    }
                  >
                    Permit2 → Router:{" "}
                    {hasEnoughRouterAllowance
                      ? "AUTHORIZED"
                      : "NOT AUTHORIZED"}
                  </div>

                  <div
                    className={
                      fullPreflightReady
                        ? "text-sm font-semibold text-emerald-300"
                        : "text-sm font-semibold text-amber-300"
                    }
                  >
                    {fullPreflightReady
                      ? "FULL PREFLIGHT READY"
                      : "FULL PREFLIGHT NOT READY"}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-emerald-300">
              READ ONLY · No approval, signature, or transaction requested
            </div>

            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
              <div className="text-xs font-semibold text-amber-300">
                Action required before execution
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Wallet needs enough USDT and an active Permit2 → PancakeSwap V3 Router authorization before a real swap can execute.
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                StockShield will never request a private key. Any approval or swap must be confirmed by you in your wallet.
              </div>

              {!hasEnoughRouterAllowance && (
                <button
                  type="button"
                  onClick={handleAuthorizeRouterPreview}
                  disabled={authorizing}
                  className="mt-3 w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-50"
                >
                  {authorizing ? "Preparing..." : "Preview Router Authorization"}
                </button>
              )}

              {authorizationStatus?.startsWith("READY TO REQUEST") &&
                !hasEnoughRouterAllowance && (
                  <div className="mt-2">
                    <div className="mb-3 rounded-lg border border-amber-400/20 bg-black/20 p-3">
                      <div className="mb-2 text-xs font-semibold text-amber-300">
                        Authorization Preview
                      </div>

                      <div className="space-y-1 text-xs text-slate-400">
                        <div className="flex justify-between gap-4">
                          <span>Amount</span>
                          <span className="text-slate-200">
                            {tradeAmount.toFixed(2)} USDT
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span>Token</span>
                          <span className="text-slate-200">USDT</span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span>Spender</span>
                          <span className="text-slate-200">
                            PancakeSwap V3 Router
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span>Network</span>
                          <span className="text-slate-200">
                            BNB Smart Chain
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span>Expires</span>
                          <span className="text-slate-200">1 hour</span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span>Permission</span>
                          <span className="text-right text-emerald-300">
                            Exact trade amount - NOT unlimited
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestRouterAuthorization}
                      disabled={authorizing}
                      className="w-full rounded-lg border border-orange-400/40 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-300 disabled:opacity-50"
                    >
                      {authorizing
                        ? "Waiting..."
                        : "Request Router Authorization"}
                    </button>
                  </div>
                )}

              {authorizationStatus && (
                <div className="mt-2 text-xs text-amber-200">
                  {authorizationStatus}
                </div>
              )}
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











