/**
 * Structured data (JSON-LD) utilities for SEO.
 *
 * Generates schema.org `JobPosting` markup for bounty listings so that
 * search engines and rich-result previews display bounty-specific
 * semantics instead of a generic `CreativeWork`.
 */

type Bounty = {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  status: string;
  ownerAddress: string;
};

/**
 * Map a bounty's status to a schema.org `JobPosting` availability value.
 *
 * - `open`       → `InStock` (still accepting applications)
 * - `completed`  → `SoldOut` (filled)
 * - `in-progress` / `in_progress` / `cancelled` → `Discontinued`
 */
function jobPostingAvailability(status: string): string {
  switch (status.replace(/-/g, "_")) {
    case "open":
      return "https://schema.org/InStock";
    case "completed":
      return "https://schema.org/SoldOut";
    default:
      return "https://schema.org/Discontinued";
  }
}

/**
 * Build a `schema.org/JobPosting` JSON-LD object from a bounty.
 *
 * The returned value should be serialised with `JSON.stringify` and injected
 * into a `<script type="application/ld+json">` tag.
 *
 * @example
 *   const ld = bountyToJobPosting(bounty);
 *   // <script type="application/ld+json">{JSON.stringify(ld)}</script>
 */
export function bountyToJobPosting(
  bounty: Bounty,
  url: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: `Bounty: ${bounty.title}`,
    description: bounty.description,
    url,
    datePosted: new Date().toISOString().split("T")[0],
    validThrough:
      bounty.deadline && bounty.deadline !== "No deadline"
        ? bounty.deadline
        : undefined,
    employmentType: "CONTRACTOR",
    hiringOrganization: {
      "@type": "Organization",
      name: "StellarBounty",
      description: "Decentralized bounty marketplace on Stellar",
    },
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Anywhere",
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: "XLM",
      value: {
        "@type": "QuantitativeValue",
        value: bounty.reward,
        unitText: "XLM",
      },
    },
    incentives: `Reward: ${bounty.reward} XLM`,
    estimatedSalary: {
      "@type": "MonetaryAmount",
      currency: "XLM",
      value: {
        "@type": "QuantitativeValue",
        value: bounty.reward,
        unitText: "XLM",
      },
    },
    industry: "Software Development",
    occupationalCategory: "15-1250", // Software Developers
    responsibilities: `Complete the described bounty task: ${bounty.description.slice(0, 120)}...`,
    skills: bounty.description
      .split(/\s+/)
      .filter((w) => /^[A-Z]/.test(w) && w.length > 2)
      .slice(0, 5)
      .join(", "),
  };
}