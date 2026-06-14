import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track your StellarBounty submissions, created bounties, rewards, and bounty status from one wallet-connected dashboard.",
  alternates: {
    canonical: "/dashboard",
  },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
