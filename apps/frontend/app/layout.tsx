import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
import { WalletProvider } from "../components/WalletContext";
import { ToastProvider } from "../components/toast/ToastProvider";
import Navbar from "./components/Navbar";
import { absoluteUrl, defaultDescription, siteName, siteUrl } from "./seo";
import "./globals.css";

const THEME_INLINE_SCRIPT = `(function(){try{var e=window.localStorage.getItem("stellar-bounty-theme");if(e==="light"||e==="dark"){document.documentElement.classList.toggle("dark",e==="dark");document.documentElement.style.colorScheme=e;return}}catch(e){}var n=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",n==="dark");document.documentElement.style.colorScheme=n})();`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INLINE_SCRIPT }} />
      </head>
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
