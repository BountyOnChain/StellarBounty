"use client";

import { useWallet } from "./WalletContext";

function truncatePublicKey(publicKey: string) {
  return `${publicKey.slice(0, 5)}...${publicKey.slice(-5)}`;
}

export function ConnectWalletButton() {
  const {
    publicKey,
    targetNetwork,
    freighterNetwork,
    isConnecting,
    error,
    connect,
    disconnect,
  } = useWallet();

  if (publicKey) {
    return (
      <div className="flex min-w-0 flex-col items-end gap-1 text-right sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 text-xs text-slate-400">
          <span className="block font-medium text-slate-100">{truncatePublicKey(publicKey)}</span>
          <span>{freighterNetwork || targetNetwork}</span>
        </div>
        <button
          type="button"
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="min-h-11 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Disconnect
        </button>
        {error ? (
          <p className="max-w-72 text-xs text-amber-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2 text-right">
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        aria-label={isConnecting ? "Connecting wallet" : "Connect wallet"}
        className="min-h-11 rounded-md bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isConnecting ? "Connecting..." : "Connect wallet"}
      </button>
      <div className="text-xs text-slate-400">
        <span>{targetNetwork}</span>
        {error ? (
          <p className="mt-1 max-w-72 text-amber-200" role="alert">
            {error}{" "}
            {error === "Freighter is not installed." ? (
              <a
                href="https://www.freighter.app/"
                className="font-medium text-teal-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                target="_blank"
                rel="noreferrer"
              >
                Install Freighter
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
