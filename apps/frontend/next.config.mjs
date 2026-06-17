import { z } from "zod";
import { withSentryConfig } from "@sentry/nextjs";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
});

const publicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
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
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  authToken: process.env.SENTRY_AUTH_TOKEN || "",
  silent: !process.env.SENTRY_DSN,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: process.env.NODE_ENV === "development",
  },
});
