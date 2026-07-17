import { notFound } from "next/navigation";
import SentryTestClient from "./SentryTestClient";

export const metadata = { title: "Sentry Test" };

// Dev-only page for verifying Sentry wiring; 404s in production builds.
export default function SentryTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <SentryTestClient />;
}
