import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <WalletProvider>
            <ToastProvider>
              <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
                <Navbar />
                {children}
              </div>
            </ToastProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
