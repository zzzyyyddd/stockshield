"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  type Address,
} from "viem";
import { bsc } from "viem/chains";

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(),
});

export default function WalletButton() {
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const loadBalance = useCallback(async (walletAddress: Address) => {
    try {
      const value = await publicClient.getBalance({
        address: walletAddress,
      });

      const formatted = Number(formatEther(value));

      setBalance(
        formatted.toLocaleString("en-US", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        }),
      );
    } catch {
      setBalance(null);
    }
  }, []);

  async function switchToBsc(provider: EthereumProvider) {
    const currentChainId = await provider.request({
      method: "eth_chainId",
    });

    if (currentChainId === "0x38") {
      return;
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }],
      });
    } catch (err) {
      const switchError = err as { code?: number };

      if (switchError.code !== 4902) {
        throw err;
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x38",
            chainName: "BNB Smart Chain",
            nativeCurrency: {
              name: "BNB",
              symbol: "BNB",
              decimals: 18,
            },
            rpcUrls: ["https://bsc-dataseed.binance.org/"],
            blockExplorerUrls: ["https://bscscan.com/"],
          },
        ],
      });
    }
  }

  async function connectWallet() {
    setError("");

    const provider = window.ethereum;

    if (!provider) {
      setError("MetaMask not detected");
      return;
    }

    try {
      setConnecting(true);

      await switchToBsc(provider);

      const walletClient = createWalletClient({
        chain: bsc,
        transport: custom(provider),
      });

      const accounts = await walletClient.requestAddresses();

      if (accounts.length > 0) {
        const walletAddress = accounts[0];

        setAddress(walletAddress);
        await loadBalance(walletAddress);
      }
    } catch (err) {
      const walletError = err as { code?: number };

      if (walletError.code === 4001) {
        setError("Connection cancelled");
      } else {
        setError("Wallet connection failed");
      }
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    const provider = window.ethereum;

    if (!provider) {
      return;
    }

    async function restoreConnection() {
      try {
        const accounts = (await provider!.request({
          method: "eth_accounts",
        })) as Address[];

        if (accounts.length > 0) {
          const walletAddress = accounts[0];

          setAddress(walletAddress);
          await loadBalance(walletAddress);
        }
      } catch {
        // No previously connected account.
      }
    }

    function handleAccountsChanged(...args: unknown[]) {
      const accounts = args[0] as Address[];

      if (accounts && accounts.length > 0) {
        const walletAddress = accounts[0];

        setAddress(walletAddress);
        void loadBalance(walletAddress);
      } else {
        setAddress(null);
        setBalance(null);
      }
    }

    function handleChainChanged() {
      if (address) {
        void loadBalance(address);
      }
    }

    restoreConnection();

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );

      provider.removeListener?.(
        "chainChanged",
        handleChainChanged,
      );
    };
  }, [address, loadBalance]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={connectWallet}
        disabled={connecting}
        className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
      >
        {connecting
          ? "Connecting..."
          : shortAddress ?? "Connect Wallet"}
      </button>

      {address && (
        <span className="text-[10px] font-medium text-emerald-400">
          BNB Smart Chain
          {balance !== null ? ` · ${balance} BNB` : ""}
        </span>
      )}

      {error && (
        <span className="text-[10px] text-amber-300">
          {error}
        </span>
      )}
    </div>
  );
}