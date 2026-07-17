import { withSentryConfig } from "@sentry/nextjs";
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const publicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
});

if (!publicEnv.success) {
  const message = publicEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid frontend environment variables:\n${message}`);
}

process.env.NEXT_PUBLIC_API_URL = publicEnv.data.NEXT_PUBLIC_API_URL;
process.env.NEXT_PUBLIC_STELLAR_NETWORK = publicEnv.data.NEXT_PUBLIC_STELLAR_NETWORK;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: publicEnv.data.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STELLAR_NETWORK: publicEnv.data.NEXT_PUBLIC_STELLAR_NETWORK,
    ...(publicEnv.data.NEXT_PUBLIC_SENTRY_DSN
      ? { NEXT_PUBLIC_SENTRY_DSN: publicEnv.data.NEXT_PUBLIC_SENTRY_DSN }
      : {}),
  },
};

export default withSentryConfig(nextConfig, {
  // Source-map upload only runs when SENTRY_ORG / SENTRY_PROJECT /
  // SENTRY_AUTH_TOKEN are present (e.g. in CI); local builds skip it.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } },
});
