/** StellarBounty SDK — type-safe API client for authentication & bounties. */

// ── Types ──────────────────────────────────────────────

export type StellarBountyConfig = {
  apiUrl: string;
};

export type BountyStatus = "open" | "in_progress" | "completed" | "cancelled";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: BountyStatus;
  createdAt: string;
  creatorId: string;
}

export interface Submission {
  id: string;
  bountyId: string;
  content: string;
  status: SubmissionStatus;
  createdAt: string;
  submitterId: string;
}

export interface ChallengeResponse {
  nonce: string;
}

export interface VerifyResponse {
  accessToken: string;
}

// ── Auth Client ────────────────────────────────────────

export class StellarBountyClient {
  private apiUrl: string;
  private token: string | null = null;

  constructor(config: StellarBountyConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, "");
  }

  /** Request a challenge nonce for the given Stellar public key. */
  async getChallenge(publicKey: string): Promise<ChallengeResponse> {
    const res = await fetch(
      `${this.apiUrl}/api/v1/auth/challenge?address=${encodeURIComponent(publicKey)}`
    );
    if (!res.ok) throw new Error("Failed to request wallet challenge.");
    return res.json();
  }

  /** Verify a signed challenge and receive an access token. */
  async verifyChallenge(
    publicKey: string,
    signedMessage: string,
    nonce: string
  ): Promise<VerifyResponse> {
    const res = await fetch(`${this.apiUrl}/api/v1/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: publicKey, signature: signedMessage, nonce }),
    });
    if (!res.ok) throw new Error("Wallet verification failed.");
    const data: VerifyResponse = await res.json();
    this.token = data.accessToken;
    return data;
  }

  /** High-level: request challenge, sign with wallet, and get token. */
  async authenticate(
    publicKey: string,
    signMessage: (nonce: string) => Promise<string>
  ): Promise<string> {
    const { nonce } = await this.getChallenge(publicKey);
    const signedMessage = await signMessage(nonce);
    const { accessToken } = await this.verifyChallenge(publicKey, signedMessage, nonce);
    return accessToken;
  }

  /** Clear the stored token. */
  clearToken(): void {
    this.token = null;
  }

  // ── Authenticated requests ───────────────────────────

  private async authFetch<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    if (!this.token) throw new Error("Not authenticated. Call authenticate() first.");
    const res = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error(`API request failed: ${res.status}`);
    return res.json();
  }

  /** List all open bounties. */
  async listBounties(): Promise<Bounty[]> {
    return this.authFetch<Bounty[]>("/api/v1/bounties");
  }

  /** Get a single bounty by ID. */
  async getBounty(id: string): Promise<Bounty> {
    return this.authFetch<Bounty>(`/api/v1/bounties/${id}`);
  }

  /** Submit work to a bounty. */
  async submitWork(
    bountyId: string,
    content: string
  ): Promise<Submission> {
    return this.authFetch<Submission>(`/api/v1/bounties/${bountyId}/submissions`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  /** List submissions for a bounty. */
  async listSubmissions(bountyId: string): Promise<Submission[]> {
    return this.authFetch<Submission[]>(`/api/v1/bounties/${bountyId}/submissions`);
  }
}
