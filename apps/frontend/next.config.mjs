import { withSentryConfig } from "@sentry/nextjs";
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
  NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),
});

const publicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
});

if (!publicEnv.success) {
  const message = publicEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid frontend environment variables:\n${message}`);
}

process.env.NEXT_PUBLIC_API_URL = publicEnv.data.NEXT_PUBLIC_API_URL;
process.env.NEXT_PUBLIC_STELLAR_NETWORK = publicEnv.data.NEXT_PUBLIC_STELLAR_NETWORK;

const sentrySourceMapUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: sentrySourceMapUploadEnabled,
  env: {
    NEXT_PUBLIC_API_URL: publicEnv.data.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STELLAR_NETWORK: publicEnv.data.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_SENTRY_DSN: publicEnv.data.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: publicEnv.data.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_RELEASE: publicEnv.data.NEXT_PUBLIC_SENTRY_RELEASE,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
  },
  sourcemaps: {
    disable: !sentrySourceMapUploadEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  tunnelRoute: "/sentry-tunnel",
  silent: !process.env.CI,
  telemetry: false,
});
