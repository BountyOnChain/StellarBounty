import { z } from "zod";

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
  env: {
    NEXT_PUBLIC_API_URL: publicEnv.data.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STELLAR_NETWORK: publicEnv.data.NEXT_PUBLIC_STELLAR_NETWORK,
  },
};

export default nextConfig;
