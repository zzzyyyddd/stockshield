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

export type WalletState = {
  connected: boolean;
  address: Address | null;
  bnbBalance: number;
  chainId: number | null;
};

type WalletButtonProps = {
  onWalletChange?: (wallet: WalletState) => void;
};

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(),
});

const emptyWallet: WalletState = {
  connected: false,
  address: null,
  bnbBalance: 0,
  chainId: null,
};

export default function WalletButton({
  onWalletChange,
}: WalletButtonProps) {
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const updateParent = useCallback(
    (
      walletAddress: Address | null,
      walletBalance: number,
      walletChainId: number | null,
    ) => {
      onWalletChange?.({
        connected: Boolean(walletAddress),
        address: walletAddress,
        bnbBalance: walletBalance,
        chainId: walletChainId,
      });
    },
    [onWalletChange],
  );

  const loadBalance = useCallback(
    async (
      walletAddress: Address,
      walletChainId: number | null = 56,
    ) => {
      try {
        const value = await publicClient.getBalance({
          address: walletAddress,
        });

        const numericBalance = Number(formatEther(value));

        setBalance(numericBalance);
        updateParent(
          walletAddress,
          numericBalance,
          walletChainId,
        );

        return numericBalance;
      } catch {
        setBalance(0);
        updateParent(walletAddress, 0, walletChainId);

        return 0;
      }
    },
    [updateParent],
  );

  async function getCurrentChainId(provider: EthereumProvider) {
    const result = await provider.request({
      method: "eth_chainId",
    });

    if (typeof result !== "string") {
      return null;
    }

    return Number.parseInt(result, 16);
  }

  async function switchToBsc(provider: EthereumProvider) {
    const currentChainId = await getCurrentChainId(provider);

    if (currentChainId === 56) {
      setChainId(56);
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
            rpcUrls: [
              "https://bsc-dataseed.binance.org/",
            ],
            blockExplorerUrls: [
              "https://bscscan.com/",
            ],
          },
        ],
      });
    }

    setChainId(56);
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

      if (accounts.length === 0) {
        return;
      }

      const walletAddress = accounts[0];

      setAddress(walletAddress);
      setChainId(56);

      await loadBalance(walletAddress, 56);
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
      updateParent(
        emptyWallet.address,
        emptyWallet.bnbBalance,
        emptyWallet.chainId,
      );
      return;
    }

    async function restoreConnection() {
      try {
        const accounts = (await provider!.request({
          method: "eth_accounts",
        })) as Address[];

        const currentChainId =
          await getCurrentChainId(provider!);

        setChainId(currentChainId);

        if (accounts.length === 0) {
          setAddress(null);
          setBalance(0);
          updateParent(null, 0, currentChainId);
          return;
        }

        const walletAddress = accounts[0];

        setAddress(walletAddress);

        await loadBalance(
          walletAddress,
          currentChainId,
        );
      } catch {
        updateParent(null, 0, null);
      }
    }

    function handleAccountsChanged(...args: unknown[]) {
      const accounts = args[0] as Address[];

      if (!accounts || accounts.length === 0) {
        setAddress(null);
        setBalance(0);
        updateParent(null, 0, chainId);
        return;
      }

      const walletAddress = accounts[0];

      setAddress(walletAddress);

      void loadBalance(
        walletAddress,
        chainId,
      );
    }

    function handleChainChanged(...args: unknown[]) {
      const rawChainId = args[0];

      if (typeof rawChainId !== "string") {
        return;
      }

      const newChainId = Number.parseInt(rawChainId, 16);

      setChainId(newChainId);

      if (address) {
        void loadBalance(
          address,
          newChainId,
        );
      } else {
        updateParent(null, 0, newChainId);
      }
    }

    void restoreConnection();

    provider.on?.(
      "accountsChanged",
      handleAccountsChanged,
    );

    provider.on?.(
      "chainChanged",
      handleChainChanged,
    );

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
  }, [
    address,
    chainId,
    loadBalance,
    updateParent,
  ]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const formattedBalance = balance.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    },
  );

  const correctNetwork = chainId === 56;

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
        <span
          className={`text-[10px] font-medium ${
            correctNetwork
              ? "text-emerald-400"
              : "text-amber-300"
          }`}
        >
          {correctNetwork
            ? `BNB Smart Chain · ${formattedBalance} BNB`
            : "Wrong network · click wallet to switch"}
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