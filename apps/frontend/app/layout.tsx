import type { Metadata } from "next";
import { WalletProvider } from "../components/WalletContext";
import { ToastProvider } from "../components/toast/ToastProvider";
import Navbar from "./components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stellarbounty.app"),
  title: {
    default: "StellarBounty | Decentralized bounty marketplace",
    template: "%s | StellarBounty",
  },
  description:
    "Discover, create, and complete funded software bounties powered by the Stellar network.",
  applicationName: "StellarBounty",
  keywords: ["Stellar", "bounties", "open source", "XLM", "developer rewards"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "StellarBounty",
    description:
      "Discover, create, and complete funded software bounties powered by the Stellar network.",
    url: "/",
    siteName: "StellarBounty",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StellarBounty",
    description:
      "Discover, create, and complete funded software bounties powered by the Stellar network.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <ToastProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100">
              <Navbar />
              {children}
            </div>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
