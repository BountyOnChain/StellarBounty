"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { localeOptions, useI18n } from "../../lib/i18n";

const NAV_LINKS = [
    { labelKey: "nav.bounties", href: "/bounties" },
    { labelKey: "nav.dashboard", href: "/dashboard" },
];

export default function Navbar() {
    const pathname = usePathname();
    const { locale, setLocale, t } = useI18n();
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
                        ? "bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shadow-lg shadow-black/30"
                        : "bg-slate-950/70 backdrop-blur-sm border-b border-slate-800"
                    }
        `}
            >
                <nav
                    className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-3 sm:px-6"
                    aria-label={t("nav.mainNavigation")}
                >
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center rounded-md px-1 text-base font-semibold tracking-normal text-slate-50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:text-lg"
                    >
                        StellarBounty
                    </Link>

                    <ul className="hidden md:flex items-center gap-1 flex-1 ml-8" role="list">
                        {NAV_LINKS.map(({ labelKey, href }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    className={`
                    relative flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                    ${isActive(href)
                                            ? "text-slate-50 bg-slate-800"
                                            : "text-slate-400 hover:text-slate-50 hover:bg-slate-800/60"
                                        }
                  `}
                                    aria-current={isActive(href) ? "page" : undefined}
                                >
                                    {t(labelKey)}
                                    {isActive(href) && (
                                        <span className="absolute bottom-0.5 left-4 right-4 h-[2px] rounded-full bg-indigo-500" />
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <label className="hidden items-center gap-2 md:flex">
                            <span className="sr-only">{t("nav.language")}</span>
                            <select
                                value={locale}
                                onChange={(event) => setLocale(event.target.value as typeof locale)}
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 outline-none transition focus:border-indigo-500"
                            >
                                {localeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="hidden md:block">
                            <ConnectWalletButton />
                        </div>

                        <button
                            onClick={() => setDrawerOpen((v) => !v)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
                            aria-label={drawerOpen ? t("nav.closeMenu") : t("nav.openMenu")}
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
                aria-label={t("nav.mobileNavigation")}
                className={`
          fixed top-16 right-0 bottom-0 z-40 w-[min(18rem,100vw)]
          bg-slate-900 border-l border-slate-800
          transform transition-transform duration-300 ease-in-out
          ${drawerOpen ? "translate-x-0 md:hidden" : "hidden translate-x-full"}
        `}
            >
                <div className="flex h-full flex-col gap-2 overflow-y-auto p-4 sm:p-6">
                    <nav aria-label={t("nav.mobileNavigation")}>
                        <ul className="space-y-1" role="list">
                            {NAV_LINKS.map(({ labelKey, href }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className={`
                      flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                      ${isActive(href)
                                                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                                                : "text-slate-400 hover:text-slate-50 hover:bg-slate-800"
                                            }
                    `}
                                        aria-current={isActive(href) ? "page" : undefined}
                                        onClick={() => setDrawerOpen(false)}
                                    >
                                        {isActive(href) && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                        )}
                                        {t(labelKey)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="my-2 border-t border-slate-800" />

                    <label className="flex flex-col gap-2 text-sm text-slate-400">
                        <span>{t("nav.language")}</span>
                        <select
                            value={locale}
                            onChange={(event) => setLocale(event.target.value as typeof locale)}
                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 outline-none focus:border-indigo-500"
                        >
                            {localeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="my-2 border-t border-slate-800" />

                    <ConnectWalletButton />
                </div>
            </aside>

            <div className="h-16" aria-hidden="true" />
        </>
    );
}
