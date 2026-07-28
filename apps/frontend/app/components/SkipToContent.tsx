"use client";

/**
 * SkipToContent — accessible skip-navigation link.
 *
 * Renders a visually-hidden link that becomes visible on keyboard focus.
 * Clicking (or pressing Enter) scrolls to `#main-content` and focuses the
 * target element so subsequent Tab presses navigate the page content rather
 * than the top navigation bar.
 *
 * Follows the GOV.UK / WAI-ARIA authoring practice for skip links.
 */
export default function SkipToContent() {
    return (
        <a
            href="#main-content"
            className="
        sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999]
        focus:inline-flex focus:items-center focus:gap-2
        focus:rounded-lg focus:border focus:border-indigo-600
        focus:bg-indigo-600 focus:px-4 focus:py-2.5
        focus:text-sm focus:font-semibold focus:text-white
        focus:shadow-lg focus:shadow-indigo-600/30
        focus:outline-none
        dark:focus:border-indigo-400 dark:focus:bg-indigo-500
        dark:focus:shadow-indigo-500/30
      "
            onClick={(e) => {
                const el = document.getElementById("main-content");
                if (el) {
                    e.preventDefault();
                    el.setAttribute("tabindex", "-1");
                    el.focus();
                    el.scrollIntoView({ behavior: "smooth" });
                    /* Remove the temporary tabindex so it doesn't clutter the Tab order */
                    el.addEventListener(
                        "blur",
                        () => el.removeAttribute("tabindex"),
                        { once: true },
                    );
                }
            }}
        >
            <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                />
            </svg>
            Skip to content
        </a>
    );
}