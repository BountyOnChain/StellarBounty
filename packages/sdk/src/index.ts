/** StellarBounty SDK — type-safe API client for the StellarBounty platform. */

// ── Types ──────────────────────────────────────────────

export type StellarBountyConfig = {
  apiUrl: string;
};

/** Bounty status as returned by the backend. */
export type BountyStatus =
  | "open"
  | "in_progress"
  | "approval_queued"
  | "completed"
  | "cancelled";

/** Submission review status. */
export type SubmissionStatus = "pending" | "approved" | "rejected";

/** Bounty object matching `BountyResponseDto`. */
export interface Bounty {
  id: string;
  title: string;
  description: string;
  /** Reward amount in stroops (BIGINT as string). */
  rewardAmount: string;
  deadline: string | null;
  status: BountyStatus;
  /** Stellar wallet address of the bounty owner. */
  ownerAddress: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Submission object matching `SubmissionResponseDto`. */
export interface Submission {
  id: string;
  bountyId: string;
  /** Contributor Stellar wallet address. */
  contributorAddress: string;
  /** URL of submitted work. */
  link: string;
  notes?: string | null;
  status: SubmissionStatus;
  createdAt: string;
}

/** Saved bounty relationship. */
export interface SavedBounty {
  id: string;
  address: string;
  bountyId: string;
  createdAt: string;
}

/** Input for creating a new bounty. */
export interface CreateBountyInput {
  title: string;
  description: string;
  /** Reward amount in stroops (string to avoid precision loss). */
  rewardAmount: string;
  ownerAddress: string;
  tags?: string[];
  deadline?: string;
}

/** Input for updating an existing bounty. All fields optional. */
export interface UpdateBountyInput {
  title?: string;
  description?: string;
  rewardAmount?: string;
  ownerAddress?: string;
  tags?: string[];
  deadline?: string;
  status?: BountyStatus;
}

/** Input for submitting work to a bounty. */
export interface CreateSubmissionInput {
  link: string;
  notes?: string;
}

/** Pagination query parameters. */
export interface PaginationQueryInput {
  page?: number;
  limit?: number;
  owner?: string;
  contributor?: string;
  status?: string;
  cursor?: string;
}

/** Paginated response wrapper matching `PaginatedResponse<T>`. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextCursor?: string | null;
}

export interface ChallengeResponse {
  nonce: string;
}

export interface VerifyResponse {
  accessToken: string;
}

// ── Error class ────────────────────────────────────────

/** Typed error for StellarBounty API failures. */
export class StellarBountyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "StellarBountyApiError";
  }
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

    if (!res.ok) {
      let code: string | undefined;
      try {
        const body = await res.json();
        code = body?.error?.code;
      } catch {
        // ignore parse failure
      }
      throw new StellarBountyApiError(
        `API request failed: ${res.status}`,
        res.status,
        code,
      );
    }
    return res.json();
  }

  // ── Bounty methods ───────────────────────────────────

  /** List bounties with optional pagination and filters. */
  async listBounties(input?: PaginationQueryInput): Promise<Paginated<Bounty>> {
    const params = new URLSearchParams();
    if (input?.page !== undefined) params.set("page", String(input.page));
    if (input?.limit !== undefined) params.set("limit", String(input.limit));
    if (input?.owner) params.set("owner", input.owner);
    if (input?.contributor) params.set("contributor", input.contributor);
    if (input?.status) params.set("status", input.status);
    if (input?.cursor) params.set("cursor", input.cursor);
    const qs = params.toString();
    return this.authFetch<Paginated<Bounty>>(`/api/v1/bounties${qs ? `?${qs}` : ""}`);
  }

  /** Get a single bounty by ID. */
  async getBounty(id: string): Promise<Bounty> {
    return this.authFetch<Bounty>(`/api/v1/bounties/${id}`);
  }

  /** Create a new bounty. */
  async createBounty(input: CreateBountyInput): Promise<Bounty> {
    return this.authFetch<Bounty>("/api/v1/bounties", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Update an existing bounty. */
  async updateBounty(id: string, patch: UpdateBountyInput): Promise<Bounty> {
    return this.authFetch<Bounty>(`/api/v1/bounties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  /** Soft-delete a bounty. */
  async deleteBounty(id: string): Promise<{ deleted: true }> {
    return this.authFetch<{ deleted: true }>(`/api/v1/bounties/${id}`, {
      method: "DELETE",
    });
  }

  /** Restore a soft-deleted bounty. */
  async restoreBounty(id: string): Promise<Bounty> {
    return this.authFetch<Bounty>(`/api/v1/bounties/${id}/restore`, {
      method: "PATCH",
    });
  }

  /** Save a bounty to the authenticated user's saved list. */
  async saveBounty(id: string): Promise<SavedBounty> {
    return this.authFetch<SavedBounty>(`/api/v1/bounties/${id}/save`, {
      method: "POST",
    });
  }

  /** Remove a bounty from the authenticated user's saved list. */
  async unsaveBounty(id: string): Promise<{ deleted: true }> {
    return this.authFetch<{ deleted: true }>(`/api/v1/bounties/${id}/save`, {
      method: "DELETE",
    });
  }

  // ── Submission methods ───────────────────────────────

  /** Submit work to a bounty. */
  async submitWork(
    bountyId: string,
    input: CreateSubmissionInput
  ): Promise<Submission> {
    return this.authFetch<Submission>(`/api/v1/bounties/${bountyId}/submissions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** List submissions for a bounty. */
  async listSubmissions(bountyId: string): Promise<Submission[]> {
    return this.authFetch<Submission[]>(`/api/v1/bounties/${bountyId}/submissions`);
  }

  /** Approve a submission (bounty owner only). */
  async approveSubmission(bountyId: string, subId: string): Promise<Submission> {
    return this.authFetch<Submission>(
      `/api/v1/bounties/${bountyId}/submissions/${subId}/approve`,
      { method: "PATCH" }
    );
  }

  /** Reject a submission (bounty owner only). */
  async rejectSubmission(bountyId: string, subId: string): Promise<Submission> {
    return this.authFetch<Submission>(
      `/api/v1/bounties/${bountyId}/submissions/${subId}/reject`,
      { method: "PATCH" }
    );
  }
}

// ── Pagination helper ──────────────────────────────────

/** Async iterator over all pages of a paginated endpoint. */
export async function* paginate<T>(
  fetchPage: (cursor: string | null) => Promise<Paginated<T>>
): AsyncIterable<T> {
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    for (const item of page.data) {
      yield item;
    }
    cursor = page.nextCursor ?? null;
  } while (cursor !== null);
}
