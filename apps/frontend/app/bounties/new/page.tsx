import type { Metadata } from "next";
import CreateBountyClient from "./CreateBountyClient";

export const metadata: Metadata = {
  title: "Create a bounty",
  description:
    "Create a funded StellarBounty task with a clear reward, deadline, and markdown requirements.",
  alternates: {
    canonical: "/bounties/new",
  },
};

export default function CreateBountyPage() {
  return <CreateBountyClient />;
}
