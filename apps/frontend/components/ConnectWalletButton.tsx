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
        <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
          <span className="block font-medium text-slate-900 dark:text-slate-100">{truncatePublicKey(publicKey)}</span>
          <span>{freighterNetwork || targetNetwork}</span>
        </div>
        <button
          type="button"
          onClick={disconnect}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
        >
          Disconnect
        </button>
        {error ? <p className="max-w-72 text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2 text-right">
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="min-h-11 rounded-md bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isConnecting ? "Connecting..." : "Connect wallet"}
      </button>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        <span>{targetNetwork}</span>
        {error ? (
          <p className="mt-1 max-w-72 text-amber-700 dark:text-amber-300">
            {error}{" "}
            {error === "Freighter is not installed." ? (
              <a
                href="https://www.freighter.app/"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
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
