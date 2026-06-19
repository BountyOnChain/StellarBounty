"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { ThemeToggle } from "../../components/ThemeToggle";

const NAV_LINKS = [
    { label: "Bounties", href: "/bounties" },
    { label: "Dashboard", href: "/dashboard" },
];

export default function Navbar() {
    const pathname = usePathname();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        document.body.style.overflow = drawerOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [drawerOpen]);

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/");

    return (
        <>
            <header
                className={`
          fixed top-0 inset-x-0 z-40 h-16
          transition-all duration-300
          ${scrolled
                        ? "border-b border-slate-200 bg-white/90 shadow-lg shadow-slate-200/70 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-black/30"
                        : "border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70"
                    }
        `}
            >
                <nav
                    className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-3 sm:px-6"
                    aria-label="Main navigation"
                >
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center rounded-md px-1 text-base font-semibold tracking-normal text-slate-900 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-50 dark:hover:text-white sm:text-lg"
                    >
                        StellarBounty
                    </Link>

                    <ul className="hidden md:flex items-center gap-1 flex-1 ml-8" role="list">
                        {NAV_LINKS.map(({ label, href }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    className={`
                    relative flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                    ${isActive(href)
                                            ? "bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-50"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-50"
                                        }
                  `}
                                    aria-current={isActive(href) ? "page" : undefined}
                                >
                                    {label}
                                    {isActive(href) && (
                                        <span className="absolute bottom-0.5 left-4 right-4 h-[2px] rounded-full bg-indigo-600 dark:bg-indigo-500" />
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <ThemeToggle />

                        <div className="hidden md:block">
                            <ConnectWalletButton />
                        </div>

                        <button
                            onClick={() => setDrawerOpen((v) => !v)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 md:hidden"
                            aria-label={drawerOpen ? "Close menu" : "Open menu"}
                            aria-expanded={drawerOpen}
                            aria-controls="mobile-drawer"
                        >
                            {drawerOpen ? (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </nav>
            </header>

            {drawerOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                    aria-hidden="true"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            <aside
                id="mobile-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
                className={`
          fixed top-16 right-0 bottom-0 z-40 w-[min(18rem,100vw)] md:hidden
          border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900
          transform transition-transform duration-300 ease-in-out
          ${drawerOpen ? "translate-x-0 md:hidden" : "hidden translate-x-full"}
        `}
            >
                <div className="flex h-full flex-col gap-2 overflow-y-auto p-4 sm:p-6">
                    <nav aria-label="Mobile navigation">
                        <ul className="space-y-1" role="list">
                            {NAV_LINKS.map(({ label, href }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className={`
                      flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                      ${isActive(href)
                                                ? "border border-indigo-500/30 bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-400"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                            }
                    `}
                                        aria-current={isActive(href) ? "page" : undefined}
                                        onClick={() => setDrawerOpen(false)}
                                    >
                                        {isActive(href) && (
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                                        )}
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

                    <ConnectWalletButton />
                </div>
            </aside>

            <div className="h-16" aria-hidden="true" />
        </>
    );
}
