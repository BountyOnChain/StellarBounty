"use client";

import { useState, useEffect } from "react";
import { useWallet } from "../../components/WalletContext";

const DISMISSED_KEY = "stellar-bounty.network-banner-dismissed";

/**
 * NetworkBanner — top-of-page dismissible alert.
 *
 * When the user's Freighter wallet is connected on a different network
 * than the app expects, this banner appears at the very top of the page
 * (above the navbar) and persists across route changes until the user
 * dismisses it or the wallet network matches.
 */
export default function NetworkBanner() {
    const { publicKey, freighterNetwork, targetNetwork } = useWallet();
    const [dismissed, setDismissed] = useState(true);

    /* Re-read dismissal flag on mount and whenever the wallet changes */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem(DISMISSED_KEY);
        setDismissed(stored === "true");
    }, [publicKey, freighterNetwork, targetNetwork]);

    const isMismatch =
        publicKey != null &&
        freighterNetwork != null &&
        freighterNetwork !== targetNetwork;

    if (!isMismatch || dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISSED_KEY, "true");
        } catch {
            /* localStorage may be unavailable in some environments */
        }
    };

    return (
        <div
            role="alert"
            className="
        relative z-50 flex items-center justify-center gap-3
        bg-amber-50 px-4 py-2.5 text-sm
        border-b border-amber-200
        dark:bg-amber-950/40 dark:border-amber-800/60
      "
        >
            <svg
                className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
            </svg>
            <span className="text-amber-800 dark:text-amber-200">
                <strong>Network mismatch:</strong> Your wallet is on{" "}
                <strong className="uppercase">{freighterNetwork}</strong>, but
                this app is configured for{" "}
                <strong className="uppercase">{targetNetwork}</strong>.
                Please switch your Freighter network to continue.
            </span>
            <button
                type="button"
                onClick={handleDismiss}
                className="
            ml-auto shrink-0 rounded-md p-1
            text-amber-600 transition-colors
            hover:bg-amber-200/60 hover:text-amber-800
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            dark:text-amber-400 dark:hover:bg-amber-800/40 dark:hover:text-amber-200
          "
                aria-label="Dismiss network warning"
            >
                <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    );
}