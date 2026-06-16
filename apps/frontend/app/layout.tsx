import type { Metadata } from "next";
import { AxeDevTools } from "../components/AxeDevTools";
import { WalletProvider } from "../components/WalletContext";
import { ToastProvider } from "../components/toast/ToastProvider";
import Navbar from "./components/Navbar";
import { absoluteUrl, defaultDescription, siteName, siteUrl } from "./seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  alternates: {
    canonical: absoluteUrl(),
  },
  openGraph: {
    title: siteName,
    description: defaultDescription,
    url: absoluteUrl(),
    siteName,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: defaultDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AxeDevTools />
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
