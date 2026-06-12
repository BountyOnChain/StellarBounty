import type { Metadata } from "next";
import { WalletProvider } from "../components/WalletContext";
import { ToastProvider } from "../components/toast/ToastProvider";
import Navbar from "./components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "StellarBounty",
  description: "Decentralized bounty marketplace on Stellar.",
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
